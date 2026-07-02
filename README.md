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

Three nested scales, seamlessly connected:

- **System view** — you start in **Sol**, running on **real JPL ephemerides**
  (Keplerian elements + centennial rates): the date readout shows where the
  planets truly are. Saturn's rings, moons, the asteroid belt, and a
  long-period comet whose tail always points away from the star.
- **Galaxy view** — zoom all the way out (or `ESC` / GALAXY MAP) and ascend
  to a procedural spiral galaxy: ~80,000 stars on four logarithmic arms with
  bulge, halo, dust lanes and nebulae, via a custom point shader.
- **Low orbit** — descend to any solid world: seeded fBm terrain, water
  shells, cloud decks and a rim-glow atmosphere, generated on arrival.

Thirty-two catalogued destinations, including:

- **Confirmed exoplanet systems** (NASA Exoplanet Archive data, inlined):
  TRAPPIST-1's seven worlds, Proxima b/d, Kepler-186b–f, 51 Peg b,
  HD 209458 b, Gliese 581, Tau Ceti, Epsilon Eridani — real radii, masses,
  periods and equilibrium temperatures.
- **Sagittarius A*** — supermassive black hole with accretion disk, photon
  ring, and the real S-cluster stars (S2, S38, S55) on their eccentric orbits.
- **PSR B1257+12** — a millisecond pulsar with sweeping beams and the first
  exoplanets ever discovered (Draugr, Poltergeist, Phobetor, 1992).
- **Binary systems** — Alpha Centauri B and the white dwarf Sirius B orbit
  inside their system views.
- Everything else is generated deterministically from the star's name.

And on top of the map:

- **Event Horizon** — predicted conjunctions and comet perihelia, found by
  root-finding over the (pure-function-of-time) positions; click to jump the
  clock to the event.
- **Mission planner** — plot a Hohmann transfer between any two planets; the
  launch window is solved numerically (Earth→Mars resolves to the real
  late-2028 window), then a probe flies the arc. Fully time-reversible.
- **Captain's log** — visited systems persist in localStorage; unvisited
  stars are UNSURVEYED fog-of-war until you jump in and scan them.
- **Guided tours** — narrated camera choreography: *The Grand Tour* (Sol)
  and *Galactic Landmarks* (Sgr A*, the pulsar, TRAPPIST-1).
- **Deep links** — every view is a shareable URL: `#/trappist-1/e`,
  `#/sol/mars/orbit?t=500`, `#/galaxy`.

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
    time.js           TimeSystem — simDays is the single source of truth
    cameraRig.js      spherical rig + eased fly-to (no OrbitControls)
    input.js          pointer/keyboard → app callbacks, drag-vs-click
    events.js         conjunction/perihelion prediction (scan + bisection)
    mission.js        Hohmann transfers, launch-window solving, probe motion
    journal.js        persistent survey log (fog of war)
    tour.js           narrated tour engine over the navigation API
  data/
    solData.js        the real solar system (compressed distances)
    ephemeris.js      JPL Keplerian elements + rates → true positions
    starCatalog.js    named stars, binaries, pulsar, Sgr A*, color helpers
    exoplanets.js     confirmed planets (NASA archive values, inlined)
    tours.js          authored tour scripts
  procgen/
    system.js         confirmed | procedural | black-hole system generator
  objects/
    planet.js         orbiting body: ephemeris/Kepler/circular positioning
    star.js           photosphere/corona; black-hole + pulsar variants
    comet.js          Kepler ellipse + anti-sunward particle tail
    asteroidBelt.js   thousands of individually-orbiting points
    starfield.js      background star sphere + drifting dust
    galaxy.js         80k-star spiral, dust lanes, nebulae, catalog sprites
  scenes/
    systemView.js     one star system: owns scene, bodies, minimap, dispose()
    galaxyView.js     the persistent galactic scene
    surfaceView.js    low orbit: fBm terrain, water, clouds, atmosphere
  ui/
    hud.js            panels (ticking digits), crumbs, catalog, console, hum
    labels.js         projected HTML labels with distance fade
  utils/
    rng.js            seeded mulberry32 + helpers (determinism everywhere)
    noise.js          seeded 3D value noise + fBm for terrain
    textures.js       every texture, drawn on canvas at runtime
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
  Glow is done with additive sprites rather than post-processing bloom, so
  there is nothing to degrade.
- **Lifecycle.** Each `SystemView` owns its scene and disposes geometry,
  materials and textures on exit; the galaxy scene is built once and kept.
