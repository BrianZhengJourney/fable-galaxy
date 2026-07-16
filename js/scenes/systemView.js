/* A star system scene — Sol or any procedural system. Owns its own
   THREE.Scene, all bodies, orbit rings, belt, comet, minimap camera and
   label registrations; disposes everything on exit. */

import * as THREE from 'three';
import { Planet, buildOrbitRing, buildEphemerisOrbit, buildKeplerOrbit } from '../objects/planet.js';
import { CentralStar } from '../objects/star.js';
import { Comet } from '../objects/comet.js';
import { AsteroidBelt } from '../objects/asteroidBelt.js';
import { buildStarSphere, buildDust } from '../objects/starfield.js';

export class SystemView {
  constructor(systemDef, labelManager){
    this.def = systemDef;
    this.labels = labelManager;
    this.scene = new THREE.Scene();

    this.starSphere = buildStarSphere('bg:' + systemDef.star.name);
    this.dust = buildDust(systemDef.extent, 'dust:' + systemDef.star.name);
    this.scene.add(this.starSphere, this.dust);

    this.star = new CentralStar(systemDef.star);
    this.scene.add(this.star.group);
    // low fill so the day/night terminator stays crisp (NASA-Eyes look);
    // real night maps light the dark side, procedural worlds keep faint fill
    this.scene.add(new THREE.AmbientLight(0x2a3a52, 0.32));

    this.planets = [];
    this.satellites = [];
    this.pickTargets = [this.star.pick];
    for (const cfg of systemDef.bodies){
      this.scene.add(cfg.eph ? buildEphemerisOrbit(cfg)
                   : cfg.kepler ? buildKeplerOrbit(cfg)
                   : buildOrbitRing(cfg.dist));
      const p = new Planet(cfg);
      this.scene.add(p.group);
      this.planets.push(p);
      this.pickTargets.push(...p.pickTargets);
      // focusable moons (Luna): track world position + make clickable
      for (const sat of (p.satellites || [])){
        this.scene.add(sat.body.group);
        this.pickTargets.push(sat.pick);
        this.satellites.push(sat);
      }
    }
    this.registerLabels();

    this.belt = systemDef.belt ? new AsteroidBelt(systemDef.belt) : null;
    if (this.belt){
      this.scene.add(this.belt.points, this.belt.pick);
      this.pickTargets.push(this.belt.pick);
    }

    this.comet = systemDef.comet ? new Comet(systemDef.comet) : null;
    if (this.comet){
      this.comet.addTo(this.scene);
      this.pickTargets.push(this.comet.pick);
    }
    this.features = [this.belt, this.comet].filter(Boolean);

    // top-down ortho camera for the minimap, sized to the system
    const e = systemDef.extent;
    this.mapCam = new THREE.OrthographicCamera(-e, e, e, -e, 1, 400);
    this.mapCam.position.set(0, 200, 0);
    this.mapCam.up.set(0, 0, -1);
    this.mapCam.lookAt(0, 0, 0);
  }

  /* labels live in a shared manager — re-register after another view used it */
  registerLabels(){
    for (const p of this.planets){
      p.labelEntry = this.labels.add(p.name, out => {
        out.copy(p.group.position);
        out.y += p.r + 0.6;
        return out;
      }, { fadeDist: this.def.extent * 2.2 });
    }
  }

  overviewDist(){ return this.def.extent * 1.45; }
  maxDist(){ return this.def.extent * 4.6; }

  findBody(name){
    return this.planets.find(p => p.name === name) || null;
  }

  /* Geological time is an appearance lens only. The orbital clock continues
     through update() unchanged, so events and mission mechanics stay valid. */
  setEpoch(epoch){
    if (!epoch) return;
    if (this.star.setAppearance) this.star.setAppearance(epoch.star);
    for (const p of this.planets) p.setAppearance(epoch.bodies[p.name]);
    if (this.belt && this.belt.setAppearance) this.belt.setAppearance(epoch.belt);
    this.epoch = epoch;
  }

  update(dt, simDays, now, camera){
    this.star.update(simDays, now, camera, dt);
    for (const p of this.planets){
      p.update(simDays, dt, now);
      if (camera) p.syncSun(camera);
    }
    // keep each focusable moon's world-position handle current
    for (const sat of this.satellites) sat.mesh.getWorldPosition(sat.body.group.position);
    if (this.belt) this.belt.update(simDays);
    if (this.comet) this.comet.update(simDays);
    this.dust.rotation.y += dt * 0.004;
    this.starSphere.rotation.y += dt * 0.0006;
  }

  dispose(){
    this.labels.clear();
    for (const p of this.planets) if (p.disposeAppearance) p.disposeAppearance();
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats){
        if (m.map && !(m.map.userData && m.map.userData.shared)) m.map.dispose();
        m.dispose();
      }
    });
    this.scene.clear();
  }
}
