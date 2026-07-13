/* Procedural canvas textures — no external assets anywhere in the project. */
import * as THREE from 'three';
import { mulberry, hashStr } from './rng.js';

export function canvasTex(w, h, draw){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function makeGlowTexture(inner, mid, size = 256){
  return canvasTex(size, size, (g, w, h) => {
    const grd = g.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.25, mid);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}

/* crisp "point of interest" glyph for landmark map markers: a hollow ring with
   four ticks and a bright core, drawn white so a Sprite's color tints it. Reads
   clearly against the round, fuzzy glows of the catalog stars. */
export function makeLandmarkGlyph(size = 128){
  return canvasTex(size, size, (g, w, h) => {
    const cx = w/2, cy = h/2, r = w*0.28;
    g.clearRect(0, 0, w, h);
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, w*0.5);
    halo.addColorStop(0, 'rgba(255,255,255,0.30)');
    halo.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineWidth = w*0.038; g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.stroke();
    g.beginPath();
    for (let k = 0; k < 4; k++){
      const a = k*Math.PI/2 + Math.PI/4;
      g.moveTo(cx + Math.cos(a)*r*1.18, cy + Math.sin(a)*r*1.18);
      g.lineTo(cx + Math.cos(a)*r*1.55, cy + Math.sin(a)*r*1.55);
    }
    g.stroke();
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, w*0.10);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, w*0.10, 0, Math.PI*2); g.fill();
  });
}

/* soft irregular smoke blob — used for nebulae and galactic dust lanes */
export function makeSmokeTexture(seedStr, rgba){
  const rnd = mulberry(hashStr(seedStr));
  return canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 26; i++){
      const x = w*0.5 + (rnd()-0.5)*w*0.6;
      const y = h*0.5 + (rnd()-0.5)*h*0.6;
      const r = 18 + rnd()*70;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(' + rgba + ',' + (0.05 + rnd()*0.1).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(' + rgba + ',0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
    }
  });
}

/* -------- planet surfaces --------
   cfg: { type, base, dark, light, bands?, spot? }
   types: cratered | venus | earth | mars | gas | ice | lava | ocean | desert | toxic */
export function makePlanetTexture(cfg, seedStr){
  const rnd = mulberry(hashStr(seedStr));
  return canvasTex(512, 256, (g, w, h) => {
    let i, x, y, r2;
    g.fillStyle = cfg.base; g.fillRect(0, 0, w, h);

    const banded = cfg.type === 'gas' || cfg.type === 'ice' ||
                   cfg.type === 'venus' || cfg.type === 'toxic';
    if (banded){
      const nb = cfg.bands || 6;
      for (i = 0; i < nb; i++){
        const yy = (i + 0.5) / nb * h + (rnd()-0.5)*14;
        const bh = h/nb * (0.55 + rnd()*0.7);
        g.fillStyle = (i % 2 === 0) ? cfg.light : cfg.dark;
        g.globalAlpha = 0.16 + rnd()*0.22;
        g.beginPath();
        g.moveTo(0, yy);
        for (x = 0; x <= w; x += 16) g.lineTo(x, yy + Math.sin(x*0.05 + i*3) * 4);
        for (x = w; x >= 0; x -= 16) g.lineTo(x, yy + bh + Math.sin(x*0.04 + i) * 5);
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      if (cfg.spot){
        g.fillStyle = '#b1512f'; g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(w*0.68, h*0.62, 30, 13, 0, 0, Math.PI*2); g.fill();
        g.fillStyle = '#d9744c'; g.globalAlpha = 0.7;
        g.beginPath(); g.ellipse(w*0.68, h*0.62, 18, 8, 0, 0, Math.PI*2); g.fill();
        g.globalAlpha = 1;
      }
    }
    if (cfg.type === 'cratered' || cfg.type === 'desert'){
      const n = cfg.type === 'desert' ? 180 : 340;
      for (i = 0; i < n; i++){
        x = rnd()*w; y = rnd()*h; r2 = rnd()*rnd()*9 + 1;
        g.fillStyle = cfg.dark; g.globalAlpha = 0.16 + rnd()*0.28;
        g.beginPath(); g.arc(x, y, r2, 0, Math.PI*2); g.fill();
        g.fillStyle = cfg.light; g.globalAlpha = 0.12;
        g.beginPath(); g.arc(x - r2*0.35, y - r2*0.35, r2*0.7, 0, Math.PI*2); g.fill();
      }
      g.globalAlpha = 1;
    }
    if (cfg.type === 'mars'){
      for (i = 0; i < 240; i++){
        x = rnd()*w; y = rnd()*h; r2 = rnd()*rnd()*16 + 2;
        g.fillStyle = rnd() > 0.5 ? cfg.dark : cfg.light;
        g.globalAlpha = 0.10 + rnd()*0.18;
        g.beginPath(); g.arc(x, y, r2, 0, Math.PI*2); g.fill();
      }
      g.strokeStyle = cfg.dark; g.globalAlpha = 0.5; g.lineWidth = 3;
      g.beginPath(); g.moveTo(w*0.3, h*0.52);
      g.bezierCurveTo(w*0.42, h*0.5, w*0.52, h*0.56, w*0.62, h*0.53); g.stroke();
      g.globalAlpha = 0.9; g.fillStyle = '#f4ece2';
      g.beginPath(); g.ellipse(w/2, 4, w/2, 14, 0, 0, Math.PI*2); g.fill();
      g.beginPath(); g.ellipse(w/2, h-4, w/2, 12, 0, 0, Math.PI*2); g.fill();
      g.globalAlpha = 1;
    }
    if (cfg.type === 'earth' || cfg.type === 'ocean'){
      const landDensity = cfg.type === 'earth' ? 26 : 9;
      for (i = 0; i < landDensity; i++){
        const cx = rnd()*w, cy = h*0.15 + rnd()*h*0.7, blobs = 5 + (rnd()*8|0);
        g.fillStyle = rnd() > 0.25 ? (cfg.light || '#3f8f5f') : '#8a7a4c';
        g.globalAlpha = 0.9;
        for (let b = 0; b < blobs; b++){
          g.beginPath();
          g.arc(cx + (rnd()-0.5)*46, cy + (rnd()-0.5)*26, 4 + rnd()*13, 0, Math.PI*2);
          g.fill();
        }
      }
      g.globalAlpha = 0.95; g.fillStyle = '#eef6fb';
      g.beginPath(); g.ellipse(w/2, 2, w/2, 16, 0, 0, Math.PI*2); g.fill();
      g.beginPath(); g.ellipse(w/2, h-2, w/2, 16, 0, 0, Math.PI*2); g.fill();
      g.fillStyle = '#ffffff';
      for (i = 0; i < 60; i++){
        g.globalAlpha = 0.10 + rnd()*0.16;
        g.beginPath();
        g.ellipse(rnd()*w, rnd()*h, 8 + rnd()*26, 3 + rnd()*6, 0, 0, Math.PI*2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (cfg.type === 'lava'){
      // dark crust with glowing fracture veins
      for (i = 0; i < 260; i++){
        x = rnd()*w; y = rnd()*h; r2 = rnd()*rnd()*12 + 2;
        g.fillStyle = cfg.dark; g.globalAlpha = 0.2 + rnd()*0.3;
        g.beginPath(); g.arc(x, y, r2, 0, Math.PI*2); g.fill();
      }
      g.globalAlpha = 1;
      for (i = 0; i < 26; i++){
        g.strokeStyle = rnd() > 0.4 ? '#ff7b2e' : '#ffc23e';
        g.lineWidth = 1 + rnd()*1.6; g.globalAlpha = 0.5 + rnd()*0.5;
        g.beginPath();
        x = rnd()*w; y = rnd()*h;
        g.moveTo(x, y);
        for (let s = 0; s < 6; s++){
          x += (rnd()-0.5)*70; y += (rnd()-0.5)*36;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // universal fine grain
    for (i = 0; i < 900; i++){
      g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#000000';
      g.globalAlpha = 0.03;
      g.fillRect(rnd()*w, rnd()*h, 1.5, 1.5);
    }
    g.globalAlpha = 1;
  });
}

/* star photosphere — tinted by the star's blackbody-ish color */
export function makeStarTexture(hexBright, hexDeep, seedStr){
  const rnd = mulberry(hashStr(seedStr || 'star'));
  return canvasTex(512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, hexBright); grd.addColorStop(0.5, hexDeep); grd.addColorStop(1, hexBright);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++){
      g.fillStyle = rnd() > 0.5 ? hexDeep : '#ffffff';
      g.globalAlpha = 0.05 + rnd()*0.10;
      const r = 2 + rnd()*rnd()*14;
      g.beginPath(); g.arc(rnd()*w, rnd()*h, r, 0, Math.PI*2); g.fill();
    }
    g.globalAlpha = 1;
  });
}

export function makeRingTexture(seedStr){
  const rnd = mulberry(hashStr(seedStr || 'rings'));
  return canvasTex(256, 4, (g, w, h) => {
    for (let x = 0; x < w; x++){
      const t = x / w;
      let a = 0.15 + 0.75 * Math.pow(Math.abs(Math.sin(t*26) * Math.sin(t*7.3)), 0.6);
      if (t < 0.06 || t > 0.97) a *= t < 0.06 ? t/0.06 : (1-t)/0.03;
      if (t > 0.55 && t < 0.61) a *= 0.15;
      const v = 190 + (rnd()*40|0);
      g.fillStyle = 'rgba(' + v + ',' + (v-25) + ',' + (v-55) + ',' + a.toFixed(3) + ')';
      g.fillRect(x, 0, 1, h);
    }
  });
}
