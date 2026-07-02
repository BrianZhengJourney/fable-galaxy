/* Screen-space HTML labels projected from 3D positions, fading with camera
   distance. Views register label entries; the manager owns the DOM. */

import * as THREE from 'three';

const _v = new THREE.Vector3();

export class LabelManager {
  constructor(container){
    this.container = container;
    this.entries = [];   // { el, getPos(outVec3), fadeDist, cls }
  }

  add(text, getPos, { fadeDist = 140, cls = '' } = {}){
    const el = document.createElement('div');
    el.className = 'lbl' + (cls ? ' ' + cls : '');
    el.textContent = text;
    this.container.appendChild(el);
    const entry = { el, getPos, fadeDist, hovered: false };
    this.entries.push(entry);
    return entry;
  }

  clear(){
    for (const e of this.entries) e.el.remove();
    this.entries = [];
  }

  update(camera, W, H){
    for (const e of this.entries){
      e.getPos(_v);
      const dCam = camera.position.distanceTo(_v);
      _v.project(camera);
      if (_v.z > 1 || _v.z < -1){ e.el.style.display = 'none'; continue; }
      const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60){
        e.el.style.display = 'none'; continue;
      }
      const op = Math.max(0, Math.min(1, 1.7 - dCam / e.fadeDist));
      e.el.style.display = 'block';
      e.el.style.left = sx + 'px';
      e.el.style.top = sy + 'px';
      e.el.style.opacity = (e.hovered ? 1 : op * 0.45).toFixed(2);
    }
  }
}
