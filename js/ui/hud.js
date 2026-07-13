/* Cockpit HUD: target panel with instrument-ticking digits, breadcrumbs,
   hover tag, stellar catalog list, time console and the ambient hum. */

import { landmarkImage } from '../data/landmarkImages.js';

function $(id){ return document.getElementById(id); }

function setInteractive(el, on){
  if (!el) return;
  if (!on && el.contains(document.activeElement) && document.activeElement instanceof HTMLElement)
    document.activeElement.blur();
  el.toggleAttribute('inert', !on);
  el.setAttribute('aria-hidden', String(!on));
}

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
    const actions = $('p-actions');
    actions.innerHTML = '';
    const acts = Array.isArray(action) ? action : (action ? [action] : []);
    for (const a of acts){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-action';
      btn.textContent = a.label;
      btn.addEventListener('click', a.cb);
      actions.appendChild(btn);
    }
    const panel = $('panel'), more = $('pMore'), details = $('p-details');
    panel.classList.remove('expanded');
    more.textContent = 'DETAILS +';
    more.setAttribute('aria-expanded', 'false');
    setInteractive(details, false);
    more.hidden = !Object.keys(info).length;
    more.onclick = () => {
      const expanded = panel.classList.toggle('expanded');
      more.textContent = expanded ? 'DETAILS −' : 'DETAILS +';
      more.setAttribute('aria-expanded', String(expanded));
      setInteractive(details, expanded);
    };
    panel.classList.add('show');
    setInteractive(panel, true);
  }
  hidePanel(){
    for (const t of this.tickTimers) clearInterval(t);
    this.tickTimers = [];
    const panel = $('panel');
    panel.classList.remove('show', 'expanded');
    setInteractive($('p-details'), false);
    setInteractive(panel, false);
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

  /* ---- compact context: one back action + the current place ---- */
  setCrumbs(parts){
    const box = $('crumbs');
    box.innerHTML = '';
    const current = parts[parts.length - 1];
    const parent = parts.slice(0, -1).reverse().find(p => p.action);
    if (parent){
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'crumb back';
      back.textContent = '← ' + parent.label;
      back.addEventListener('click', parent.action);
      box.appendChild(back);
    }
    if (current){
      const here = document.createElement('span');
      here.className = 'crumb here'; here.textContent = current.label;
      box.appendChild(here);
    }
  }

  setSector(name){ $('roSector').textContent = name; }

  /* ---- cosmic landmarks catalog + story card ---- */
  buildLandmarks(entries, categories, onPick, options = {}){
    this._featuredLandmarks = entries;
    this._archiveLandmarks = options.archive || entries;
    this._landmarkCategories = categories;
    this._landmarkPick = onPick;
    this._landmarkArchiveOpen = false;
    const toggle = $('lmArchiveToggle');
    toggle.onclick = () => {
      this._landmarkArchiveOpen = !this._landmarkArchiveOpen;
      this._renderLandmarks();
    };
    this._renderLandmarks();
  }
  _renderLandmarks(){
    const list = $('lmList');
    list.innerHTML = '';
    const entries = this._landmarkArchiveOpen ? this._archiveLandmarks : this._featuredLandmarks;
    const groups = this._landmarkArchiveOpen
      ? this._landmarkCategories.map(cat => ({ cat, entries: entries.filter(e => e.category === cat.key) }))
      : [{ cat: null, entries }];
    for (const group of groups){
      if (!group.entries.length) continue;
      if (group.cat){
        const h = document.createElement('div');
        h.className = 'lm-cat'; h.textContent = group.cat.label;
        h.style.color = group.cat.color;
        list.appendChild(h);
      }
      const grid = document.createElement('div');
      grid.className = 'lm-grid';
      for (const e of group.entries){
        const item = document.createElement('button');
        item.type = 'button'; item.className = 'lm-item';
        const img = landmarkImage(e.id);
        if (img){
          item.classList.add('has-image');
          const imageURL = new URL(img.file, document.baseURI).href;
          item.style.setProperty('--lm-image', `url("${imageURL}")`);
        }
        const n = document.createElement('span'); n.className = 'n'; n.textContent = e.name;
        const s = document.createElement('span'); s.className = 's';
        s.textContent = e.subtitle || e.designation;
        item.appendChild(n); item.appendChild(s);
        item.addEventListener('click', () => this._landmarkPick(e));
        grid.appendChild(item);
      }
      list.appendChild(grid);
    }
    $('lmCount').textContent = this._landmarkArchiveOpen
      ? this._archiveLandmarks.length + ' ARCHIVE OBJECTS'
      : this._featuredLandmarks.length + ' FIELD STORIES';
    $('lmArchiveToggle').textContent = this._landmarkArchiveOpen
      ? '← FEATURED STORIES'
      : 'VIEW FULL ARCHIVE · ' + this._archiveLandmarks.length;
  }
  setLandmarksVisible(on){ $('landmarks').classList.toggle('show', on); }

  showLandmarkCard(e, cat, handlers){
    const experience = handlers.experience || null;
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
    $('lmCardWow').textContent = (experience && experience.summary) || e.subtitle || e.famousFor || '';
    $('lmCardFact').textContent = e.wow || '';
    $('lmCardStory').textContent = e.story || '';
    $('lmCardNote').textContent = experience ? experience.note || '' : '';
    $('lmCardCredit').textContent = handlers.credit ? 'IMAGE · ' + handlers.credit : '';
    const card = $('lmCard'), details = $('lmCardDetails'), more = $('lmMore');
    card.classList.remove('expanded');
    setInteractive(details, false);
    more.textContent = 'MORE +';
    more.setAttribute('aria-expanded', 'false');
    more.onclick = () => {
      const expanded = card.classList.toggle('expanded');
      setInteractive(details, expanded);
      more.setAttribute('aria-expanded', String(expanded));
      more.textContent = expanded ? 'LESS −' : 'MORE +';
    };
    const act = $('lmAction');
    if (handlers.action){ act.textContent = handlers.action.label; act.classList.remove('hidden'); }
    else act.classList.add('hidden');
    act.onclick = handlers.action ? handlers.action.cb : null;
    // wavelength crossfade (exhibits with an aligned IR counterpart)
    const wave = $('lmWave');
    if (handlers.wavelength){
      this._landmarkIR = false;
      this._landmarkWavelength = handlers.wavelength;
      this.setLandmarkWavelength(false);
      wave.classList.remove('hidden');
      wave.onclick = () => handlers.wavelength(!this._landmarkIR);
    } else {
      this._landmarkIR = false; this._landmarkWavelength = null;
      wave.classList.add('hidden'); wave.onclick = null;
    }
    $('lmPrev').onclick = handlers.onPrev;
    $('lmNext').onclick = handlers.onNext;
    $('lmExit').onclick = handlers.onExit;
    card.classList.add('show');
    setInteractive(card, true);
  }
  setLandmarkWavelength(ir){
    this._landmarkIR = !!ir;
    const wave = $('lmWave');
    wave.textContent = ir ? 'VISIBLE' : 'INFRARED';
    wave.setAttribute('aria-label', ir ? 'Switch to visible light' : 'Switch to infrared');
  }
  hideLandmarkCard(){
    const card = $('lmCard');
    card.classList.remove('show', 'expanded');
    setInteractive($('lmCardDetails'), false);
    setInteractive(card, false);
  }

  /* ---- semantic milestone rail (not a linear simulation scrubber) ---- */
  showStoryline(experience, onSelect){
    this._storyExperience = experience;
    this._storySelect = onSelect;
    const track = $('storyTrack');
    track.innerHTML = '';
    for (const [index, moment] of experience.moments.entries()){
      const node = document.createElement('button');
      node.type = 'button'; node.className = 'story-node'; node.dataset.moment = moment.id;
      node.id = 'story-tab-' + index;
      node.setAttribute('role', 'tab');
      node.setAttribute('aria-label', moment.date + ': ' + moment.title);
      node.setAttribute('aria-controls', 'storyCopy');
      node.setAttribute('aria-selected', 'false');
      node.tabIndex = -1;
      const dot = document.createElement('i');
      const label = document.createElement('span'); label.textContent = moment.date;
      node.appendChild(dot); node.appendChild(label);
      node.addEventListener('click', () => this.selectStoryMoment(moment.id));
      node.addEventListener('keydown', event => {
        const nodes = [...track.querySelectorAll('.story-node')];
        const current = nodes.indexOf(event.currentTarget);
        let next = current;
        if (event.key === 'ArrowRight') next = (current + 1) % nodes.length;
        else if (event.key === 'ArrowLeft') next = (current - 1 + nodes.length) % nodes.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = nodes.length - 1;
        else return;
        event.preventDefault();
        this.selectStoryMoment(nodes[next].dataset.moment);
        nodes[next].focus();
      });
      track.appendChild(node);
    }
    document.body.classList.add('story-mode');
    setInteractive($('console'), false);
    const storyline = $('storyline');
    storyline.classList.add('show');
    setInteractive(storyline, true);
    this.selectStoryMoment(experience.defaultMoment || experience.moments[0].id);
  }
  selectStoryMoment(id, notify = true){
    if (!this._storyExperience) return;
    const moment = this._storyExperience.moments.find(m => m.id === id)
      || this._storyExperience.moments[0];
    let activeNode = null;
    for (const node of document.querySelectorAll('#storyTrack .story-node')){
      const active = node.dataset.moment === moment.id;
      node.classList.toggle('active', active);
      node.setAttribute('aria-selected', String(active));
      node.tabIndex = active ? 0 : -1;
      if (active) activeNode = node;
    }
    $('storyDate').textContent = moment.date;
    $('storyKind').textContent = moment.kind || '';
    $('storyTitle').textContent = moment.title;
    $('storyText').textContent = moment.text || '';
    const source = $('storySource');
    if (moment.source){ source.href = moment.source; source.classList.remove('hidden'); }
    else { source.removeAttribute('href'); source.classList.add('hidden'); }
    if (activeNode){
      $('storyCopy').setAttribute('aria-labelledby', activeNode.id);
      this._scrollStoryNodeIntoView(activeNode);
    }
    if (notify && this._storySelect) this._storySelect(moment);
  }
  _scrollStoryNodeIntoView(node){
    if (this._storyScrollFrame) cancelAnimationFrame(this._storyScrollFrame);
    this._storyScrollFrame = requestAnimationFrame(() => {
      this._storyScrollFrame = null;
      const track = node.parentElement;
      if (!node.isConnected || !node.classList.contains('active') ||
          !track || track.scrollWidth <= track.clientWidth + 1) return;
      const left = node.offsetLeft - (track.clientWidth - node.offsetWidth) / 2;
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      track.scrollTo({ left: Math.max(0, left), behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  hideStoryline(){
    if (this._storyScrollFrame){
      cancelAnimationFrame(this._storyScrollFrame);
      this._storyScrollFrame = null;
    }
    document.body.classList.remove('story-mode');
    const storyline = $('storyline');
    storyline.classList.remove('show');
    setInteractive(storyline, false);
    setInteractive($('console'), true);
    this._storyExperience = null; this._storySelect = null;
  }
  setMode(mode){ document.body.dataset.mode = mode; }
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
    $('brandBtn').addEventListener('click', () => app.exitToGalaxy());
    $('mapBtn').addEventListener('click', () => app.exitToGalaxy());
    $('audioBtn').addEventListener('click', () => this._toggleAudio());
  }

  /* ---- ambient soundscape + UI sounds (see core AudioEngine) ---- */
  _toggleAudio(){
    const btn = $('audioBtn');
    const ok = this.app.audio.setEnabled(!this.app.audio.enabled);
    if (!ok){ btn.textContent = 'SOUND N/A'; return; }
    if (this.app.audio.enabled){
      btn.textContent = 'SOUND ON'; btn.classList.add('on');
      this.app.audio.select();
    } else {
      btn.textContent = 'SOUND OFF'; btn.classList.remove('on');
    }
  }
}
