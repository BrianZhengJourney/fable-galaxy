/* Cockpit HUD: target panel with instrument-ticking digits, breadcrumbs,
   hover tag, stellar catalog list, time console and the ambient hum. */

function $(id){ return document.getElementById(id); }

export class Hud {
  constructor(app){
    this.app = app;
    this.tickTimers = [];
    this.audioCtx = null;
    this.audioOn = false;
    this._wire();
  }

  /* ---- target data panel ---- */
  showPanel(tag, name, cls, info){
    for (const t of this.tickTimers) clearInterval(t);
    this.tickTimers = [];
    $('p-tag').textContent = tag;
    $('p-name').textContent = name;
    $('p-class').textContent = cls;
    const rows = $('p-rows');
    rows.innerHTML = '';
    for (const [k, v] of Object.entries(info)){
      const row = document.createElement('div');
      row.className = 'prow';
      const ks = document.createElement('span'); ks.className = 'k'; ks.textContent = k;
      const vs = document.createElement('span'); vs.className = 'v';
      row.appendChild(ks); row.appendChild(vs); rows.appendChild(row);
      this._tickInto(vs, v);
    }
    $('panel').classList.add('show');
  }
  hidePanel(){
    for (const t of this.tickTimers) clearInterval(t);
    this.tickTimers = [];
    $('panel').classList.remove('show');
  }
  _tickInto(el, finalStr){
    const frames = 14;
    let f = 0;
    const iv = setInterval(() => {
      f++;
      const lock = Math.floor(finalStr.length * (f / frames));
      let out = '';
      for (let i = 0; i < finalStr.length; i++){
        const ch = finalStr[i];
        out += (i < lock || !/[0-9]/.test(ch)) ? ch : String((Math.random() * 10) | 0);
      }
      el.textContent = out;
      if (f >= frames){ el.textContent = finalStr; clearInterval(iv); }
    }, 38);
    this.tickTimers.push(iv);
  }

  /* ---- hover tag ---- */
  hover(x, y, text){
    const tag = $('hoverTag');
    if (text){
      tag.style.display = 'block';
      tag.style.left = (x + 16) + 'px';
      tag.style.top = (y - 8) + 'px';
      tag.textContent = text;
    } else tag.style.display = 'none';
  }

  /* ---- breadcrumbs: GALAXY ▸ STAR ▸ BODY ---- */
  setCrumbs(parts){
    // parts: [{label, action|null}], last one styled as "here"
    const box = $('crumbs');
    box.innerHTML = '';
    parts.forEach((p, i) => {
      if (i){
        const sep = document.createElement('span');
        sep.className = 'sep'; sep.textContent = '▸';
        box.appendChild(sep);
      }
      const el = document.createElement('span');
      el.className = 'crumb' + (i === parts.length - 1 ? ' here' : '');
      el.textContent = p.label;
      if (p.action && i !== parts.length - 1) el.addEventListener('click', p.action);
      box.appendChild(el);
    });
  }

  setSector(name){ $('roSector').textContent = name; }
  setMinimapVisible(on){ $('mapFrame').classList.toggle('hidden', !on); }
  setCatalogVisible(on){ $('catalog').classList.toggle('show', on); }

  buildCatalog(entries, onPick){
    const list = $('catList');
    list.innerHTML = '';
    for (const rec of entries){
      const item = document.createElement('div');
      item.className = 'cat-item';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = rec.name;
      const c = document.createElement('span'); c.className = 'c'; c.textContent = rec.cls;
      item.appendChild(n); item.appendChild(c);
      item.addEventListener('click', () => onPick(rec));
      list.appendChild(item);
    }
  }

  /* ---- readouts + time console ---- */
  updateReadouts(time){
    $('roDate').textContent = time.fmtDate();
    $('roRate').textContent = time.fmtRate();
    $('roElapsed').textContent = time.fmtElapsed();
  }
  syncTimeButtons(rate){
    $('btnPlay').classList.toggle('active', Math.abs(rate - 10) < 0.5);
    $('btnPause').classList.toggle('active', rate === 0);
    $('btnFF').classList.toggle('active', rate > 12);
    $('btnRev').classList.toggle('active', rate < 0);
    $('scrub').value = this.app.time.rateToScrub();
  }

  flash(){
    const f = $('flash');
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 120);
  }

  _wire(){
    const app = this.app, time = app.time;
    const setRate = r => { time.setRate(r); this.syncTimeButtons(time.rate); };

    $('scrub').addEventListener('input', e => {
      time.setRate(time.scrubToRate(parseFloat(e.target.value)));
      this.syncTimeButtons(time.rate);
    });
    $('btnPlay').addEventListener('click', () => setRate(10));
    $('btnPause').addEventListener('click', () => setRate(0));
    $('btnFF').addEventListener('click', () => setRate(time.rate <= 0 ? 40 : time.rate * 4));
    $('btnRev').addEventListener('click', () =>
      setRate(time.rate === 0 ? -10 : (time.rate > 0 ? -time.rate : time.rate * 4)));
    $('mapBtn').addEventListener('click', () => app.exitToGalaxy());
    $('audioBtn').addEventListener('click', () => this._toggleAudio());
  }

  /* ---- ambient hum: detuned sines + filtered noise, off by default ---- */
  _toggleAudio(){
    const btn = $('audioBtn');
    if (!this.audioOn){
      try{
        if (!this.audioCtx){
          const AC = window.AudioContext || window.webkitAudioContext;
          const ctx = this.audioCtx = new AC();
          const master = ctx.createGain(); master.gain.value = 0.035;
          master.connect(ctx.destination);
          for (const f of [55, 55.7]){
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
            const g = ctx.createGain(); g.gain.value = 0.5;
            o.connect(g); g.connect(master); o.start();
          }
          const len = ctx.sampleRate * 2;
          const buf = ctx.createBuffer(1, len, ctx.sampleRate);
          const ch = buf.getChannelData(0);
          for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
          const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 220;
          const ng = ctx.createGain(); ng.gain.value = 0.25;
          src.connect(flt); flt.connect(ng); ng.connect(master); src.start();
          ctx._master = master;
        }
        this.audioCtx.resume();
        this.audioCtx._master.gain.value = 0.035;
        this.audioOn = true;
        btn.textContent = 'AUDIO ▸ ON'; btn.classList.add('on');
      }catch(e){ btn.textContent = 'AUDIO ▸ N/A'; }
    } else {
      this.audioCtx._master.gain.value = 0;
      this.audioOn = false;
      btn.textContent = 'AUDIO ▸ OFF'; btn.classList.remove('on');
    }
  }
}
