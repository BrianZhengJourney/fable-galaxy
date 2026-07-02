/* Camera rig: a spherical offset around a possibly-moving target, with an
   eased fly-to. During a flight we blend from the recorded start pose toward
   the LIVE desired pose each frame, so gliding to a moving planet works.
   No dependency on THREE.OrbitControls. */

import * as THREE from 'three';

function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

export class CameraRig {
  constructor(camera){
    this.camera = camera;
    this.theta = 0.6; this.phi = 1.05; this.dist = 95;
    this.minDist = 12; this.maxDist = 300;
    this.getTarget = () => _ZERO;            // set by the active view
    this.flying = false; this.flyT = 0; this.flyDur = 1.25;
    this.fromPos = new THREE.Vector3();
    this.fromTgt = new THREE.Vector3();
    this.lookTgt = new THREE.Vector3();
    this.autoRotate = true;
    this.lastInteract = -10;
    this._tgt = new THREE.Vector3();
    this._off = new THREE.Vector3();
    this._desired = new THREE.Vector3();
  }

  interact(now){ this.lastInteract = now; }

  drag(dx, dy){
    this.theta -= dx * 0.0055;
    this.phi = Math.max(0.08, Math.min(Math.PI - 0.08, this.phi - dy * 0.0045));
  }
  zoom(deltaY){
    this.dist = Math.max(this.minDist, Math.min(this.maxDist,
      this.dist * Math.exp(deltaY * 0.0011)));
  }

  /* begin an eased flight toward a new target/pose */
  flyTo({ getTarget, dist, phi, theta, dur }){
    this.fromPos.copy(this.camera.position);
    this.fromTgt.copy(this.lookTgt);
    if (getTarget) this.getTarget = getTarget;
    if (dist !== undefined) this.dist = dist;
    if (phi !== undefined) this.phi = phi;
    if (theta !== undefined) this.theta = theta;
    this.flyDur = dur || 1.25;
    this.flying = true; this.flyT = 0;
  }

  /* hard cut (used right after a hyperjump flash) */
  snap({ getTarget, dist, phi, theta }){
    if (getTarget) this.getTarget = getTarget;
    if (dist !== undefined) this.dist = dist;
    if (phi !== undefined) this.phi = phi;
    if (theta !== undefined) this.theta = theta;
    this.flying = false;
    this.update(0, 0);
  }

  update(dt, now){
    if (this.autoRotate && !this.flying && now - this.lastInteract > 3)
      this.theta += dt * 0.045;

    this._tgt.copy(this.getTarget());
    this._off.set(
      this.dist * Math.sin(this.phi) * Math.sin(this.theta),
      this.dist * Math.cos(this.phi),
      this.dist * Math.sin(this.phi) * Math.cos(this.theta));
    this._desired.copy(this._tgt).add(this._off);

    if (this.flying){
      this.flyT += dt;
      const u = easeInOutCubic(Math.min(1, this.flyT / this.flyDur));
      this.camera.position.lerpVectors(this.fromPos, this._desired, u);
      this.lookTgt.lerpVectors(this.fromTgt, this._tgt, u);
      if (this.flyT >= this.flyDur) this.flying = false;
    } else {
      this.camera.position.copy(this._desired);
      this.lookTgt.copy(this._tgt);
    }
    this.camera.lookAt(this.lookTgt);
  }
}

const _ZERO = new THREE.Vector3();
