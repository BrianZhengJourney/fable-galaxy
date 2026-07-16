# GALAXY 42

**An Interactive Atlas of Worlds Through Time.**

GALAXY 42 is a multi-scale 3D atlas where planets and cosmic landmarks unfold
as visual timelines. It combines a real-time Sol system, a procedural galaxy,
and source-grounded field stories in an instrument-like interface. Pure ES
modules + [three.js](https://threejs.org) load from a CDN import map, with **no
build step**. Procedural worlds are drawn on canvas at runtime; Sol is rendered
to near-NASA-Eyes fidelity — 8K albedo, a Blue-Marble
day/night shader with real city lights on the dark side, ocean-specular glint,
and surface relief that casts shadow at the terminator (NASA LOLA lunar
elevation; Mercury/Mars normals derived from albedo). Assets: public
[Solar System Scope](https://www.solarsystemscope.com/textures) imagery (CC BY
4.0), [three.js](https://github.com/mrdoob/three.js) Earth normal/specular
(MIT), and NASA SVS lunar elevation (public domain) — see
[textures/CREDITS.md](textures/CREDITS.md). Ambient soundscape and UI are
synthesized WebAudio; the star catalogs come from a small build script.

## Running and checking it

Open the whole repository folder in Cursor, then start the no-cache local
server from Cursor's terminal:

```sh
cd <clone-folder>
npm start
# open → http://127.0.0.1:8741/
```

Keep that terminal running. Use a second terminal for the automated checks:

```sh
npm test
```

The five timeline-driven field exhibits have direct preview URLs:

- `http://127.0.0.1:8741/#/landmark/pillars-of-creation`
- `http://127.0.0.1:8741/#/landmark/carina-nebula`
- `http://127.0.0.1:8741/#/landmark/crab-nebula`
- `http://127.0.0.1:8741/#/landmark/m87-black-hole-image`
- `http://127.0.0.1:8741/#/landmark/pale-blue-dot`

The physical black-hole models are available at `#/sagittarius-a` and at the
`cygnus-x-1`, `m87-star`, `sagittarius-a-star`, and `gw150914` landmark routes.

The curated nebula and remnant fields use dedicated photo-sculpt 3D profiles.
Each opens with a short 1.2-second source-observation hold, keeps the object
name visible through a 1.2-second reveal, and then exposes `SPLIT /
OBSERVATION / 3D MODEL` controls for direct comparison. The former generic
soft-cloud box is not part of this path. Preview any one with
`http://127.0.0.1:8741/#/landmark/<id>`; for example:

- `http://127.0.0.1:8741/#/landmark/orion-nebula`
- `http://127.0.0.1:8741/#/landmark/horsehead-nebula`
- `http://127.0.0.1:8741/#/landmark/ring-nebula`
- `http://127.0.0.1:8741/#/landmark/veil-nebula`

Solar System appearance checkpoints:

- `http://127.0.0.1:8741/#/sol?t=0&epoch=1000ma` — Rodinia model, 1 Ga
- `http://127.0.0.1:8741/#/sol?t=0&epoch=5ma` — Pliocene model, 5 Ma
- `http://127.0.0.1:8741/#/sol?t=0` — present observations

Drag to inspect depth, click every timeline milestone, and resize the browser
to check mobile layout. Press `Ctrl+C` in the server terminal when finished.
ES modules cannot load correctly over `file://`, so opening `index.html`
directly is not sufficient.

## What it is

Three nested scales, seamlessly connected:

- **System view** — you start in **Sol**, running on **real JPL ephemerides**
  (Keplerian elements + centennial rates): the date readout shows where the
  planets truly are. Saturn's rings, moons, the asteroid belt, and a
  long-period comet whose tail always points away from the star. Every rendered
  semantic object is selectable: the Sun, eight planets, visible rings, seven
  modeled moons, the belt and the comet.
- **Model epoch** — a separate appearance control changes the Sun, rocky-world
  climate overlays, giant-planet weather, artificial night lights, axial-tilt
  scenarios and ring confidence at 1 Ga, 5 Ma and today. Mercury stays
  effectively unchanged at globe scale; Venus receives new dynamic cloud
  markings; Mars moves ice away from its poles in a labeled high-obliquity
  scenario; and each gas/ice giant receives a different deterministic weather
  map with modern named storms removed. It never feeds ancient dates into the present-valid
  ephemeris: exact planetary phases are not reconstructable at 1 Ga. The
  hand-authored Rodinia and Pliocene globes are schematic artist's
  reconstructions inspired by the [Merdith et al. full-plate model](https://doi.org/10.1016/j.earscirev.2020.103477)
  and [Scotese–Wright PaleoDEM archive](https://doi.org/10.5281/zenodo.5460860),
  not rasters derived from either dataset. The asteroid belt remains present
  in both mature epochs. Saturn's ghosted 1 Ga rings explicitly encode an
  unresolved age, not known absence; its near-upright ancient axis is one
  [Titan-migration hypothesis](https://doi.org/10.1038/s41550-020-01284-x),
  not settled history. Model sources include [Mars obliquity/ice migration](https://doi.org/10.1038/nature03055),
  [Venus cloud dynamics](https://www.esa.int/Science_Exploration/Space_Science/Chasing_clouds_on_Venus),
  [Jupiter's likely young Great Red Spot](https://doi.org/10.1029/2024GL108993),
  [Uranus seasonal color](https://doi.org/10.1093/mnras/stad3761), and
  [Neptune vortex lifetimes](https://doi.org/10.3847/1538-3881/ab0747).
- **Galaxy view** — zoom all the way out (or `ESC` / GALAXY MAP) and ascend
  to a procedural spiral galaxy: ~80,000 stars on four logarithmic arms with
  bulge, halo, dust lanes and nebulae, via a custom point shader.
- **Low orbit** — descend to any solid world: seeded fBm terrain, water
  shells, cloud decks and a rim-glow atmosphere, generated on arrival.

Thirty-two destinations, including:

- **Confirmed exoplanet systems** (NASA Exoplanet Archive data, inlined):
  TRAPPIST-1's seven worlds, Proxima b/d, Kepler-186b–f, 51 Peg b,
  HD 209458 b, Gliese 581, Tau Ceti, Epsilon Eridani — real radii, masses,
  periods and equilibrium temperatures.
- **Relativistic black holes** — Sagittarius A*, M87*, Cygnus X-1 and
  GW150914 share a camera-aware shader core: a true-black horizon, turbulent
  accretion flow, Doppler-brightened side and upper/lower lensed disk images.
  Each keeps its real context—S-cluster orbits, M87's jet, Cygnus X-1's donor
  star and mass-transfer stream, or a near-vacuum merger. GW150914 pairs its
  model with official LIGO discovery artwork, then swaps to the authentic
  detector-strain figure in the detection chapter.
- **PSR B1257+12** — a millisecond pulsar with sweeping beams and the first
  exoplanets ever discovered (Draugr, Poltergeist, Phobetor, 1992).
- **Binary systems** — Alpha Centauri B and the white dwarf Sirius B orbit
  inside their system views.
- Everything else is generated deterministically from the star's name.

And on top of the map:

- **Event Horizon** — rare five-, six- and seven-planet model groupings plus
  comet perihelia. Long-range groupings show their member worlds, angular arc
  and year-only `MODEL PROJECTION` label; click any event to jump there and
  hold the simulation still.
- **Mission planner** — plot a Hohmann transfer between any two planets; the
  launch window is solved numerically (Earth→Mars resolves to the real
  late-2028 window), then a probe flies the arc. Fully time-reversible.
- **Captain's log** — visited systems persist in localStorage; unvisited
  stars are UNSURVEYED fog-of-war until you jump in and scan them.
- **Guided tours** — narrated camera choreography: *The Grand Tour* (Sol)
  and *Galactic Landmarks* (Sgr A*, the pulsar, TRAPPIST-1).
- **Deep links** — every view is a shareable URL: `#/trappist-1/e`,
  `#/sol/mars/orbit?t=500`, `#/sol?epoch=1000ma`, `#/galaxy`.
- **Night-sky mode** (`#/sol/earth/sky`) — stand on Earth and see the *real*
  sky for the simulation date: 6,000 HYG stars, the IAU constellation
  figures, and the Sun, Moon and planets placed geocentrically from the same
  ephemerides that drive the orrery. Drag to look around, scroll to zoom
  FOV, fast-forward to wheel the sky through the night.
- **Real neighbourhood geometry** — the 30 catalog stars sit at their true
  J2000 directions (log-compressed distances), surrounded by a point cloud
  of the actual sub-25 pc solar neighbourhood colored by B−V index.
- **Photometer** — a live transit light curve along your line of sight.
  Align TRAPPIST-1 edge-on and watch the flux dips that discovered it.

## Controls

| Input | Action |
|---|---|
| Drag | Orbit the view |
| Scroll | Zoom (zoom far out of a system to ascend to the galaxy) |
| Click planet / star | Fly to it, open the data panel |
| Click empty space | Return to overview |
| Click galaxy star ×2 | Hyperjump into its system |
| `ESC` | Step up one level (planet → system → galaxy) |
| `Space` | Pause / resume time |
| Bottom scrubber | Time rate, exponential from −1580 to +1580 days/sec |

## Architecture

```
index.html            shell, import map, HUD DOM, fatal-error fallback
css/main.css          cockpit styling (cyan/amber instrument palette)
dev-server.py         no-cache static server for development
test/core.test.mjs    node --test suite for the dependency-free core
js/
  main.js             App: mode switching, picking, transitions, main loop
  core/
    astro.js          sidereal time, frames, geocentric Sun/Moon/planets
    time.js           TimeSystem — simDays is the orbital source of truth
    route.js          hash parser for orbital date + independent model epoch
    cameraRig.js      spherical rig + eased fly-to (no OrbitControls)
    input.js          pointer/keyboard → app callbacks, drag-vs-click
    events.js         multi-planet grouping / conjunction / perihelion search
    mission.js        Hohmann transfers, launch-window solving, probe motion
    journal.js        persistent survey log (fog of war)
    tour.js           narrated tour engine over the navigation API
  data/
    solData.js        the real solar system (compressed distances)
    solEpochs.js      complete 1 Ga / 5 Ma / present appearance snapshots
    planetEpochRecipes.js pure registry for modeled non-Earth epoch surfaces
    ephemeris.js      JPL Keplerian elements + rates → true positions
    starCatalog.js    named stars, binaries, pulsar, Sgr A*, color helpers
    exoplanets.js     confirmed planets (NASA archive values, inlined)
    tours.js          authored tour scripts
    gen/              GENERATED: HYG stars + constellation lines
tools/build-starcatalog.mjs  regenerates data/gen from HYG + d3-celestial
  procgen/
    system.js         confirmed | procedural | black-hole system generator
  objects/
    planet.js         orbiting body: ephemeris/Kepler/circular positioning
    star.js           photosphere/corona; shared black-hole + pulsar variants
    blackHoleVisual.js camera-aware accretion, Doppler and analytic lensing core
    comet.js          Kepler ellipse + anti-sunward particle tail
    asteroidBelt.js   thousands of individually-orbiting points
    starfield.js      background star sphere + drifting dust
    galaxy.js         80k-star spiral, dust lanes, nebulae, catalog sprites
  scenes/
    systemView.js     one star system: owns scene, bodies, minimap, dispose()
    galaxyView.js     the persistent galactic scene
    surfaceView.js    low orbit: fBm terrain, water, clouds, atmosphere
    skyView.js        night sky: real stars/constellations over an observer
  ui/
    photometer.js     live transit light-curve instrument
    hud.js            panels (ticking digits), crumbs, stories, console, ambience
    labels.js         projected HTML labels with distance fade
  utils/
    rng.js            seeded mulberry32 + helpers (determinism everywhere)
    noise.js          seeded 3D value noise + fBm for terrain
    textures.js       procedural planet/ring textures drawn at runtime
    earthEpochTextures.js  Rodinia + Pliocene equirectangular reconstructions
    planetEpochTextures.js modeled Venus/Mars/giant-planet epoch textures
```

Run the tests with `npm test` (plain `node --test`, no dependencies).

### Design notes

- **Distances are compressed, periods are real.** True orbital spacing
  (0.4 AU vs 30 AU) collapses inner systems into a pixel; spacing is
  hand-tuned while orbital *speeds* keep their real ratios — Mercury laps
  Neptune ~684× per Neptune year, and you can watch that at high time rates.
- **Determinism.** All procedural content (galaxy, textures, exosystems) is
  seeded. No `Math.random()` in world-gen paths; revisiting a star reproduces
  its system exactly.
- **Graceful failure.** No WebGL, no CDN, no import-map support — each path
  lands on a readable "RENDER LINK FAILURE" panel instead of a black screen.
  Post-processing bloom (UnrealBloomPass) loads as an optional enhancement;
  if the addons import fails, the additive-sprite glow pipeline stands alone.
- **Lifecycle.** Each `SystemView` owns its scene and disposes geometry,
  materials and textures on exit; the galaxy scene is built once and kept.
