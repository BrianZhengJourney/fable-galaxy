# FABLE GALAXY // Deep Field Command

An interactive, multi-scale 3D galaxy explorer with a sci-fi cockpit aesthetic.
Pure ES modules + [three.js](https://threejs.org) from a CDN import map —
**no build step, no external assets**; every texture, star and world is
generated procedurally at runtime.

## Running it

Serve the folder with any static file server and open `index.html`:

```sh
cd fable-galaxy
python3 -m http.server 8741
# → http://localhost:8741/
```

(Modules can't load over `file://`, so a server is required.)

## What it is

Two nested scales, seamlessly connected:

- **System view** — you start in **Sol**: all 8 planets with real relative
  orbital periods, axial tilts, Saturn's rings, moons for Earth/Jupiter/Saturn,
  the asteroid belt, and a long-period comet on a true Kepler ellipse whose
  tail always points away from the star.
- **Galaxy view** — zoom all the way out (or press `ESC` / GALAXY MAP) and you
  ascend to a procedural spiral galaxy: ~80,000 stars distributed along four
  logarithmic arms with a bulge, halo, dust lanes and emission nebulae, all
  rendered through a custom point shader.

Thirty named stars of the local neighbourhood (Sirius, Vega, TRAPPIST-1,
Betelgeuse, …) are pinned into the arm as clickable **stellar contacts**.
Click one to fly to it; click again to hyperjump into its system — generated
deterministically from the star's name, so Kepler-186 always has the same
worlds: lava planets, ocean worlds, ringed giants, toxic dwarfs, belts and
comets, each with instrument-panel data.

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
js/
  main.js             App: mode switching, picking, transitions, main loop
  core/
    time.js           TimeSystem — simDays is the single source of truth
    cameraRig.js      spherical rig + eased fly-to (no OrbitControls)
    input.js          pointer/keyboard → app callbacks, drag-vs-click
  data/
    solData.js        the real solar system (compressed distances, real periods)
    starCatalog.js    named neighbourhood stars + blackbody color helpers
  procgen/
    system.js         seeded exoplanet system generator (Sol-shaped output)
  objects/
    planet.js         orbiting body: tilt, spin, rings, moons, pick sphere
    star.js           photosphere + tinted corona sprite stack
    comet.js          Kepler ellipse + anti-sunward particle tail
    asteroidBelt.js   thousands of individually-orbiting points
    starfield.js      background star sphere + drifting dust
    galaxy.js         80k-star spiral, dust lanes, nebulae, catalog sprites
  scenes/
    systemView.js     one star system: owns scene, bodies, minimap, dispose()
    galaxyView.js     the persistent galactic scene
  ui/
    hud.js            data panel (ticking digits), crumbs, catalog, console, hum
    labels.js         projected HTML labels with distance fade
  utils/
    rng.js            seeded mulberry32 + helpers (determinism everywhere)
    textures.js       every texture, drawn on canvas at runtime
```

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
  Glow is done with additive sprites rather than post-processing bloom, so
  there is nothing to degrade.
- **Lifecycle.** Each `SystemView` owns its scene and disposes geometry,
  materials and textures on exit; the galaxy scene is built once and kept.
