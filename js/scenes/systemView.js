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
    this.scene.add(new THREE.AmbientLight(0x30425a, 0.5));

    this.planets = [];
    this.pickTargets = [this.star.pick];
    for (const cfg of systemDef.bodies){
      this.scene.add(cfg.eph ? buildEphemerisOrbit(cfg)
                   : cfg.kepler ? buildKeplerOrbit(cfg)
                   : buildOrbitRing(cfg.dist));
      const p = new Planet(cfg);
      this.scene.add(p.group);
      this.planets.push(p);
      this.pickTargets.push(p.pick);
      labelManager.add(p.name, out => out.copy(p.group.position).setY(p.r + 0.6 + out.y),
        { fadeDist: systemDef.extent * 2.2 });
      p.labelEntry = labelManager.entries[labelManager.entries.length - 1];
    }

    this.belt = systemDef.belt ? new AsteroidBelt(systemDef.belt) : null;
    if (this.belt) this.scene.add(this.belt.points);

    this.comet = systemDef.comet ? new Comet(systemDef.comet) : null;
    if (this.comet) this.comet.addTo(this.scene);

    // top-down ortho camera for the minimap, sized to the system
    const e = systemDef.extent;
    this.mapCam = new THREE.OrthographicCamera(-e, e, e, -e, 1, 400);
    this.mapCam.position.set(0, 200, 0);
    this.mapCam.up.set(0, 0, -1);
    this.mapCam.lookAt(0, 0, 0);
  }

  overviewDist(){ return this.def.extent * 1.45; }
  maxDist(){ return this.def.extent * 4.6; }

  findBody(name){
    return this.planets.find(p => p.name === name) || null;
  }

  update(dt, simDays, now){
    this.star.update(simDays, now);
    for (const p of this.planets) p.update(simDays);
    if (this.belt) this.belt.update(simDays);
    if (this.comet) this.comet.update(simDays);
    this.dust.rotation.y += dt * 0.004;
    this.starSphere.rotation.y += dt * 0.0006;
  }

  dispose(){
    this.labels.clear();
    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats){
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
    this.scene.clear();
  }
}
