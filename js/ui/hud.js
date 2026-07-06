/* Cockpit HUD: target panel with instrument-ticking digits, breadcrumbs,
   hover tag, stellar catalog list, time console and the ambient hum. */

function $(id){ return document.getElementById(id); }

export class Hud {
  constructor(app){
    this.app = app;
    this.tickTimers = [];
    this._wire();
  }

  /* ---- target data panel ---- */
  showPanel(tag, name, cls, info, action){
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
    const acts = Array.isArray(action) ? action : (action ? [action] : []);
    for (const a of acts){
      const btn = document.createElement('div');
      btn.className = 'p-action';
      btn.textContent = a.label;
      btn.addEventListener('click', a.cb);
      rows.appendChild(btn);
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

  /* ---- cosmic landmarks catalog + story card ---- */
  buildLandmarks(entries, categories, onPick){
    const list = $('lmList');
    list.innerHTML = '';
    for (const cat of categories){
      const inCat = entries.filter(e => e.category === cat.key);
      if (!inCat.length) continue;
      const h = document.createElement('div');
      h.className = 'lm-cat'; h.textContent = cat.label + ' · ' + inCat.length;
      h.style.color = cat.color;
      list.appendChild(h);
      for (const e of inCat){
        const item = document.createElement('div');
        item.className = 'lm-item';
        item.innerHTML = '<div class="n">' + e.name + '</div><div class="s">' +
          e.designation + '</div>';
        item.addEventListener('click', () => onPick(e));
        list.appendChild(item);
      }
    }
  }
  setLandmarksVisible(on){ $('landmarks').classList.toggle('show', on); }

  showLandmarkCard(e, cat, handlers){
    $('lmCardCat').textContent = cat ? cat.label : e.category;
    $('lmCardCat').style.color = cat ? cat.color : 'var(--amber)';
    $('lmCardName').textContent = e.name;
    $('lmCardDesig').textContent = e.designation;
    const meta = [];
    if (e.distance && e.distance !== '—') meta.push('<span>DISTANCE</span> <b>' + e.distance + '</b>');
    if (e.date && e.date !== '—') meta.push('<span>DATE</span> <b>' + e.date + '</b>');
    if (e.raDeg != null) meta.push('<span>RA/DEC</span> <b>' + e.raDeg.toFixed(1) + '° / ' +
      e.decDeg.toFixed(1) + '°</b>');
    $('lmCardMeta').innerHTML = meta.join('');
    $('lmCardWow').textContent = e.wow || '';
    $('lmCardStory').textContent = e.story || '';
    const act = $('lmAction');
    if (handlers.action){ act.textContent = handlers.action.label; act.classList.remove('hidden'); }
    else act.classList.add('hidden');
    act.onclick = handlers.action ? handlers.action.cb : null;
    $('lmPrev').onclick = handlers.onPrev;
    $('lmNext').onclick = handlers.onNext;
    $('lmExit').onclick = handlers.onExit;
    $('lmCard').classList.add('show');
  }
  hideLandmarkCard(){ $('lmCard').classList.remove('show'); }
  setEventsVisible(on){ $('events').classList.toggle('show', on); }
  setMissionVisible(on){ $('mission').classList.toggle('show', on); }
  setMissionBody(html){ $('msBody').innerHTML = html; }

  renderEvents(events, fmtDateAt, onJump){
    const list = $('evList');
    list.innerHTML = '';
    if (!events.length){
      const empty = document.createElement('div');
      empty.className = 'ev-item';
      empty.innerHTML = '<span class="l">— NO EVENTS IN RANGE —</span>';
      list.appendChild(empty);
      return;
    }
    for (const ev of events){
      const item = document.createElement('div');
      item.className = 'ev-item';
      const l = document.createElement('div'); l.className = 'l'; l.textContent = ev.label;
      const d = document.createElement('div'); d.className = 'd';
      d.innerHTML = ev.type + ' · <b>' + fmtDateAt(ev.t) + '</b>';
      item.appendChild(l); item.appendChild(d);
      item.addEventListener('click', () => onJump(ev));
      list.appendChild(item);
    }
  }
  setMinimapVisible(on){
    $('mapFrame').classList.toggle('hidden', !on);
    $('photometer').classList.toggle('show', on);   // instruments travel together
  }
  setCatalogVisible(on){ $('catalog').classList.toggle('show', on); }

  buildCatalog(entries, onPick, journal){
    const list = $('catList');
    list.innerHTML = '';
    for (const rec of entries){
      const known = !journal || journal.isVisited(rec.name);
      const item = document.createElement('div');
      item.className = 'cat-item' + (known ? '' : ' unk');
      const n = document.createElement('span'); n.className = 'n'; n.textContent = rec.name;
      const c = document.createElement('span'); c.className = 'c';
      c.textContent = known ? rec.cls : 'UNSURVEYED';
      item.appendChild(n); item.appendChild(c);
      item.addEventListener('click', () => onPick(rec));
      list.appendChild(item);
    }
    if (journal){
      const title = document.querySelector('#catalog .cat-title');
      title.textContent = 'STELLAR CATALOG · ' + journal.surveyed() + '/' + entries.length + ' SURVEYED';
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

  /* ---- ambient soundscape + UI sounds (see core AudioEngine) ---- */
  _toggleAudio(){
    const btn = $('audioBtn');
    const ok = this.app.audio.setEnabled(!this.app.audio.enabled);
    if (!ok){ btn.textContent = 'AUDIO ▸ N/A'; return; }
    if (this.app.audio.enabled){
      btn.textContent = 'AUDIO ▸ ON'; btn.classList.add('on');
      this.app.audio.select();
    } else {
      btn.textContent = 'AUDIO ▸ OFF'; btn.classList.remove('on');
    }
  }
}
