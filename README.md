# 47

**An Interactive Atlas of Worlds Through Time.**

47 is a multi-scale 3D atlas where planets and cosmic landmarks unfold
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

## Running it

Serve the folder with any static file server and open `index.html`:

```sh
cd <clone-folder>
npm start
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
    gen/              GENERATED: HYG stars + constellation lines
tools/build-starcatalog.mjs  regenerates data/gen from HYG + d3-celestial
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
    skyView.js        night sky: real stars/constellations over an observer
  ui/
    photometer.js     live transit light-curve instrument
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
  Post-processing bloom (UnrealBloomPass) loads as an optional enhancement;
  if the addons import fails, the additive-sprite glow pipeline stands alone.
- **Lifecycle.** Each `SystemView` owns its scene and disposes geometry,
  materials and textures on exit; the galaxy scene is built once and kept.
