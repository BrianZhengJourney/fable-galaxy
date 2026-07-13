#!/usr/bin/env python3
"""Convert NASA/STScI's Pillars STL into a compact, indexed GLB.

The downloadable positioning-reference STL is a 737k-triangle print mesh. This
tool applies deterministic vertex-cluster simplification, computes smooth
normals, and writes the minimal glTF Binary needed by the browser exhibit.

It intentionally uses only NumPy and the Python standard library. Example:

  uv run --with numpy tools/prepare_pillars_model.py \
    /tmp/pillars-positioning.stl models/pillars-of-creation.glb

Source model and credit:
  https://science.nasa.gov/asset/webb/pillars-of-creation-model-for-3d-printing/
  Leah Hustak (STScI), Ralf Crawford (STScI)
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

import numpy as np


SOURCE_URL = (
    "https://science.nasa.gov/asset/webb/"
    "pillars-of-creation-model-for-3d-printing/"
)


def read_binary_stl(path: Path) -> np.ndarray:
    with path.open("rb") as stream:
        stream.seek(80)
        raw_count = stream.read(4)
    if len(raw_count) != 4:
        raise ValueError(f"{path} is not a binary STL")
    face_count = struct.unpack("<I", raw_count)[0]
    facet = np.dtype(
        [
            ("normal", "<f4", (3,)),
            ("vertices", "<f4", (3, 3)),
            ("attribute", "<u2"),
        ]
    )
    expected = 84 + face_count * facet.itemsize
    if path.stat().st_size != expected:
        raise ValueError(
            f"unexpected STL size: expected {expected}, got {path.stat().st_size}"
        )
    records = np.fromfile(path, dtype=facet, offset=84, count=face_count)
    return np.asarray(records["vertices"], dtype=np.float32)


def cluster_simplify(triangles: np.ndarray, cell_size: float):
    points = triangles.reshape(-1, 3)
    minimum = points.min(axis=0)
    cells = np.floor((points - minimum) / cell_size + 0.5).astype(np.int32)
    _, inverse = np.unique(cells, axis=0, return_inverse=True)

    counts = np.bincount(inverse)
    vertices = np.empty((len(counts), 3), dtype=np.float32)
    for axis in range(3):
        vertices[:, axis] = np.bincount(
            inverse, weights=points[:, axis], minlength=len(counts)
        ) / counts

    faces = inverse.reshape(-1, 3)
    keep = (
        (faces[:, 0] != faces[:, 1])
        & (faces[:, 1] != faces[:, 2])
        & (faces[:, 2] != faces[:, 0])
    )
    faces = faces[keep]

    # Adjacent source facets often collapse to the same clustered triangle.
    keys = np.sort(faces, axis=1)
    _, first = np.unique(keys, axis=0, return_index=True)
    faces = faces[np.sort(first)]

    used, remap = np.unique(faces, return_inverse=True)
    vertices = vertices[used]
    faces = remap.reshape(-1, 3)

    # Discard the occasional zero-area facet left after averaging a cluster.
    edge_a = vertices[faces[:, 1]] - vertices[faces[:, 0]]
    edge_b = vertices[faces[:, 2]] - vertices[faces[:, 0]]
    face_normals = np.cross(edge_a, edge_b)
    area2 = np.einsum("ij,ij->i", face_normals, face_normals)
    valid = area2 > cell_size**4 * 1e-8
    faces = faces[valid]
    face_normals = face_normals[valid]

    normals = np.zeros_like(vertices)
    for corner in range(3):
        np.add.at(normals, faces[:, corner], face_normals)
    lengths = np.linalg.norm(normals, axis=1)
    normals /= np.maximum(lengths[:, None], 1e-12)
    return vertices.astype("<f4"), normals.astype("<f4"), faces


def pad4(data: bytes, fill: bytes = b"\0") -> bytes:
    return data + fill * ((-len(data)) % 4)


def write_glb(path: Path, vertices, normals, faces, cell_size: float):
    if len(vertices) <= 65535:
        indices = faces.astype("<u2", copy=False)
        index_component = 5123  # UNSIGNED_SHORT
    else:
        indices = faces.astype("<u4", copy=False)
        index_component = 5125  # UNSIGNED_INT

    position_bytes = vertices.tobytes()
    normal_bytes = normals.tobytes()
    index_bytes = indices.tobytes()
    position_offset = 0
    normal_offset = len(position_bytes)
    index_offset = normal_offset + len(normal_bytes)
    binary = pad4(position_bytes + normal_bytes + index_bytes)

    document = {
        "asset": {
            "version": "2.0",
            "generator": "47/tools/prepare_pillars_model.py",
            "extras": {
                "source": SOURCE_URL,
                "credit": "Leah Hustak (STScI), Ralf Crawford (STScI)",
                "simplification": f"vertex cluster {cell_size:g}",
            },
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Pillars of Creation"}],
        "meshes": [
            {
                "name": "NASA-STScI four-pillar positioning model",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1},
                        "indices": 2,
                        "mode": 4,
                    }
                ],
            }
        ],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": position_offset,
                "byteLength": len(position_bytes),
                "target": 34962,
            },
            {
                "buffer": 0,
                "byteOffset": normal_offset,
                "byteLength": len(normal_bytes),
                "target": 34962,
            },
            {
                "buffer": 0,
                "byteOffset": index_offset,
                "byteLength": len(index_bytes),
                "target": 34963,
            },
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": len(vertices),
                "type": "VEC3",
                "min": vertices.min(axis=0).tolist(),
                "max": vertices.max(axis=0).tolist(),
            },
            {
                "bufferView": 1,
                "componentType": 5126,
                "count": len(normals),
                "type": "VEC3",
            },
            {
                "bufferView": 2,
                "componentType": index_component,
                "count": int(indices.size),
                "type": "SCALAR",
            },
        ],
    }

    json_chunk = pad4(
        json.dumps(document, separators=(",", ":")).encode("utf-8"), b" "
    )
    total = 12 + 8 + len(json_chunk) + 8 + len(binary)
    with path.open("wb") as stream:
        stream.write(struct.pack("<4sII", b"glTF", 2, total))
        stream.write(struct.pack("<I4s", len(json_chunk), b"JSON"))
        stream.write(json_chunk)
        stream.write(struct.pack("<I4s", len(binary), b"BIN\0"))
        stream.write(binary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--cell",
        type=float,
        default=0.0001,
        help=(
            "vertex-cluster cell size in source model units; the 0.0001 default "
            "only welds coincident STL vertices and preserves native detail"
        ),
    )
    args = parser.parse_args()
    if args.cell <= 0:
        parser.error("--cell must be positive")

    triangles = read_binary_stl(args.source)
    vertices, normals, faces = cluster_simplify(triangles, args.cell)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_glb(args.output, vertices, normals, faces, args.cell)
    print(
        f"wrote {args.output}: {len(vertices):,} vertices, "
        f"{len(faces):,} triangles, {args.output.stat().st_size / 1_048_576:.2f} MiB"
    )


if __name__ == "__main__":
    main()
