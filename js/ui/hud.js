/* Cockpit HUD: target panel with instrument-ticking digits, breadcrumbs,
   hover tag, time console and the ambient hum. */

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
    this._wireInstrumentDrawer();
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

  /* ---- first-run orientation + lightweight feedback ---- */
  onboardingSeen(){
    try{ return localStorage.getItem('galaxy-42-onboarded-v1') === 'true'; }
    catch(e){ return false; }
  }
  completeOnboarding(){
    try{ localStorage.setItem('galaxy-42-onboarded-v1', 'true'); }catch(e){ /* private mode */ }
    this.setWelcomeVisible(false);
  }
  setWelcomeVisible(on){
    const panel = $('welcome');
    const visible = !!on;
    if (visible === panel.classList.contains('show')) return;
    if (visible){
      this._welcomeSiblingInert = new Map();
      for (const sibling of document.body.children){
        if (sibling === panel || sibling.tagName === 'SCRIPT') continue;
        this._welcomeSiblingInert.set(sibling, sibling.hasAttribute('inert'));
        sibling.setAttribute('inert', '');
      }
    }
    panel.classList.toggle('show', visible);
    setInteractive(panel, visible);
    if (visible) requestAnimationFrame(() => panel.querySelector('[data-journey]')?.focus());
    else {
      for (const [sibling, wasInert] of this._welcomeSiblingInert || []){
        if (sibling.isConnected) sibling.toggleAttribute('inert', wasInert);
      }
      this._welcomeSiblingInert = null;
    }
  }
  showContextHint(key, text){
    if (!text || $('welcome').classList.contains('show')) return;
    const storageKey = 'galaxy-42-hint-' + key;
    try{
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, 'true');
    }catch(e){ /* private mode: still show the hint */ }
    clearTimeout(this._hintTimer);
    $('contextHintText').textContent = text;
    const hint = $('contextHint');
    hint.classList.add('show');
    hint.setAttribute('aria-hidden', 'false');
    this._hintTimer = setTimeout(() => this.hideContextHint(), 6500);
  }
  hideContextHint(){
    clearTimeout(this._hintTimer);
    const hint = $('contextHint');
    hint.classList.remove('show');
    hint.setAttribute('aria-hidden', 'true');
  }
  toast(message){
    clearTimeout(this._toastTimer);
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    toast.setAttribute('aria-hidden', 'false');
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.setAttribute('aria-hidden', 'true');
    }, 2600);
  }

  /* ---- mobile system instruments ---- */
  _wireInstrumentDrawer(){
    $('instrumentBtn').addEventListener('click', () =>
      this.setInstrumentDrawerVisible(!document.body.classList.contains('instruments-open')));
    $('instrumentClose').addEventListener('click', () => this.setInstrumentDrawerVisible(false));
    for (const button of document.querySelectorAll('[data-instrument]')){
      button.addEventListener('click', () => {
        document.body.dataset.instrumentPanel = button.dataset.instrument;
        for (const candidate of document.querySelectorAll('[data-instrument]'))
          candidate.setAttribute('aria-pressed', String(candidate === button));
      });
    }
  }
  setInstrumentDrawerVisible(on){
    const drawer = $('instrumentDrawer');
    const visible = !!on;
    document.body.classList.toggle('instruments-open', visible);
    if (visible && !document.body.dataset.instrumentPanel)
      document.body.dataset.instrumentPanel = 'events';
    $('instrumentBtn').setAttribute('aria-expanded', String(visible));
    setInteractive(drawer, visible);
    if (visible) requestAnimationFrame(() => {
      const initial = document.body.dataset.mode === 'system'
        ? drawer.querySelector('[aria-pressed="true"]') : $('drawerShare');
      initial?.focus();
    });
  }

  /* ---- visible Captain's Log ---- */
  renderJournal(entries, total, onPick){
    $('logCount').textContent = String(entries.length);
    $('journalSummary').innerHTML = '<b>' + entries.length + '</b> DESTINATIONS RECORDED · ' +
      total + ' IN THE CURATED COLLECTION';
    const list = $('journalList');
    list.innerHTML = '';
    if (!entries.length){
      const empty = document.createElement('p');
      empty.className = 'journal-empty';
      empty.textContent = 'No field records yet. Enter a world system or a featured cosmic environment to begin.';
      list.appendChild(empty);
      return;
    }
    for (const entry of entries){
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'journal-entry';
      button.setAttribute('aria-label', 'Return to ' + entry.name + ', ' + entry.visits + ' visits');
      const kind = document.createElement('span'); kind.className = 'kind';
      kind.textContent = entry.kind === 'landmark' ? 'FIELD STORY' : 'WORLD SYSTEM';
      const name = document.createElement('span'); name.className = 'name'; name.textContent = entry.name;
      const date = document.createElement('span'); date.className = 'date';
      date.textContent = 'LAST VISIT · ' + (entry.last || entry.first || 'UNKNOWN');
      const visits = document.createElement('span'); visits.className = 'visits';
      visits.textContent = '×' + entry.visits;
      button.append(kind, name, date, visits);
      button.addEventListener('click', () => onPick(entry));
      list.appendChild(button);
    }
  }
  setJournalVisible(on){
    const panel = $('journalPanel');
    const visible = !!on;
    if (visible === panel.classList.contains('show')) return;
    if (visible){
      this.setInstrumentDrawerVisible(false);
      this.setLandmarksVisible(false);
      this._journalReturnFocus = document.activeElement;
      this._journalSiblingInert = new Map();
      for (const sibling of document.body.children){
        if (sibling === panel || sibling.tagName === 'SCRIPT') continue;
        this._journalSiblingInert.set(sibling, sibling.hasAttribute('inert'));
        sibling.setAttribute('inert', '');
      }
    }
    panel.classList.toggle('show', visible);
    $('logBtn').setAttribute('aria-expanded', String(visible));
    setInteractive(panel, visible);
    if (visible) requestAnimationFrame(() => $('journalClose').focus());
    else {
      for (const [sibling, wasInert] of this._journalSiblingInert || []){
        if (sibling.isConnected) sibling.toggleAttribute('inert', wasInert);
      }
      this._journalSiblingInert = null;
      if (this._journalReturnFocus instanceof HTMLElement && this._journalReturnFocus.isConnected)
        this._journalReturnFocus.focus();
      this._journalReturnFocus = null;
    }
  }

  /* ---- curated cosmic landmarks catalog + story card ---- */
  buildLandmarks(sections, onPick){
    this._landmarkSections = sections;
    this._landmarkPick = onPick;
    const panel = $('landmarks');
    panel.onkeydown = event => {
      if (event.key === 'Escape'){
        event.preventDefault();
        event.stopPropagation();
        this.setLandmarksVisible(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button:not([disabled])')]
        .filter(button => button.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first){
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last){
        event.preventDefault(); first.focus();
      }
    };
    this._renderLandmarks();
  }
  _renderLandmarks(){
    const list = $('lmList');
    const nav = $('lmSectionNav');
    list.innerHTML = '';
    nav.innerHTML = '';
    let total = 0;

    for (const [sectionIndex, section] of this._landmarkSections.entries()){
      if (!section.items.length) continue;
      total += section.items.length;
      const sectionId = 'explore-' + section.id;

      const jump = document.createElement('button');
      jump.type = 'button';
      jump.textContent = section.label;
      jump.setAttribute('aria-controls', sectionId);
      jump.addEventListener('click', () => {
        const target = document.getElementById(sectionId);
        if (target) target.scrollIntoView({ block: 'start' });
      });
      nav.appendChild(jump);

      const sectionElement = document.createElement('section');
      sectionElement.className = 'lm-section';
      sectionElement.id = sectionId;
      sectionElement.style.setProperty('--lm-accent', section.color);

      const heading = document.createElement('header');
      heading.className = 'lm-section-head';
      const index = document.createElement('span');
      index.className = 'lm-section-index';
      index.textContent = String(sectionIndex + 1).padStart(2, '0') + ' · ' + section.kicker;
      index.setAttribute('aria-hidden', 'true');
      const title = document.createElement('h3');
      title.textContent = section.label;
      const count = document.createElement('span');
      count.className = 'lm-section-count';
      count.textContent = section.items.length + (section.items.length === 1 ? ' EXPERIENCE' : ' EXPERIENCES');
      count.setAttribute('aria-hidden', 'true');
      const intro = document.createElement('p');
      intro.className = 'dsp-sr-only';
      intro.textContent = section.intro;
      heading.appendChild(index);
      heading.appendChild(title);
      heading.appendChild(count);
      heading.appendChild(intro);
      sectionElement.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'lm-grid';
      for (const record of section.items){
        const e = record.entry;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'lm-item';
        item.dataset.destination = e.id;
        if (record.kind === 'landmark') item.dataset.landmark = e.id;
        if (record.kind === 'system') item.dataset.system = record.target;
        const accessibleDetails = [e.designation, ...record.badges].filter(Boolean).join(' · ');
        item.setAttribute('aria-label', 'Explore ' + e.name +
          (accessibleDetails ? ' · ' + accessibleDetails : ''));
        const img = record.kind === 'landmark'
          ? landmarkImage(e.id)
          : record.coverFile ? { file: record.coverFile } : null;
        if (img){
          item.classList.add('has-image');
          const imageURL = new URL(img.coverFile || img.file, document.baseURI).href;
          item.style.setProperty('--lm-image', `url("${imageURL}")`);
          item.style.setProperty('--lm-image-position', record.imagePosition || 'center');
        }

        if (record.kind === 'system') item.classList.add('system-card');

        const badges = document.createElement('span');
        badges.className = 'lm-badges';
        for (const text of record.badges){
          const badge = document.createElement('span');
          badge.textContent = text;
          badges.appendChild(badge);
        }
        const copy = document.createElement('span');
        copy.className = 'lm-item-copy';
        const n = document.createElement('span'); n.className = 'n'; n.textContent = e.name;
        const s = document.createElement('span'); s.className = 's';
        s.textContent = e.designation;
        copy.appendChild(n); copy.appendChild(s);
        item.appendChild(badges); item.appendChild(copy);
        item.addEventListener('click', () => this._landmarkPick(record));
        grid.appendChild(item);
      }
      sectionElement.appendChild(grid);
      list.appendChild(sectionElement);
    }
    $('lmCount').textContent = total + ' CURATED EXPERIENCES';
  }
  landmarksVisible(){ return $('landmarks').classList.contains('show'); }
  setLandmarksVisible(on){
    const panel = $('landmarks');
    const button = $('landmarkBtn');
    const visible = !!on;
    if (visible === this.landmarksVisible()) return;
    if (visible){
      this._landmarkReturnFocus = document.activeElement;
      this._exploreSiblingInert = new Map();
      for (const sibling of document.body.children){
        if (sibling === panel || sibling.tagName === 'SCRIPT') continue;
        this._exploreSiblingInert.set(sibling, sibling.hasAttribute('inert'));
        sibling.setAttribute('inert', '');
      }
    }
    panel.classList.toggle('show', visible);
    document.body.classList.toggle('explore-open', visible);
    button.setAttribute('aria-expanded', String(visible));
    setInteractive(panel, visible);
    if (visible){
      $('lmList').scrollTop = 0;
      requestAnimationFrame(() => $('lmClose').focus());
    } else {
      for (const [sibling, wasInert] of this._exploreSiblingInert || []){
        if (sibling.isConnected) sibling.toggleAttribute('inert', wasInert);
      }
      this._exploreSiblingInert = null;
      if (this._landmarkReturnFocus instanceof HTMLElement &&
          this._landmarkReturnFocus.isConnected){
        this._landmarkReturnFocus.focus();
      }
      this._landmarkReturnFocus = null;
    }
  }

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
    this.setLandmarkCredit(handlers.credit);
    const card = $('lmCard'), details = $('lmCardDetails'), more = $('lmMore');
    card.classList.remove('expanded');
    setInteractive(details, false);
    more.textContent = 'ⓘ';
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-label', 'Show object details');
    more.title = 'Show object details';
    more.onclick = () => {
      const expanded = card.classList.toggle('expanded');
      setInteractive(details, expanded);
      more.setAttribute('aria-expanded', String(expanded));
      more.setAttribute('aria-label', expanded ? 'Hide object details' : 'Show object details');
      more.title = expanded ? 'Hide object details' : 'Show object details';
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
  setLandmarkCredit(credit){
    const node = $('lmCardCredit');
    if (!credit){ node.textContent = ''; return; }
    if (typeof credit === 'string'){
      node.textContent = 'IMAGE · ' + credit;
      return;
    }
    node.textContent = (credit.label || 'SOURCE') + ' · ' + (credit.text || '');
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
  showStoryline(experience, onSelect, { initialMomentId = null } = {}){
    this._storyExperience = experience;
    this._storySelect = onSelect;
    const views = $('storyViewModes');
    views.innerHTML = '';
    const viewModes = Array.isArray(experience.viewModes) ? experience.viewModes : [];
    views.classList.toggle('show', viewModes.length > 0);
    for (const mode of viewModes){
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'story-view';
      button.dataset.mode = mode.id;
      button.dataset.moment = mode.momentId;
      button.textContent = mode.label;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () =>
        this.selectStoryMoment(mode.momentId, true, { user: true }));
      views.appendChild(button);
    }
    const track = $('storyTrack');
    track.innerHTML = '';
    const storyMoments = experience.moments.filter(moment => !moment.presentationOnly);
    for (const [index, moment] of storyMoments.entries()){
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
      node.addEventListener('click', () =>
        this.selectStoryMoment(moment.id, true, { user: true }));
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
        this.selectStoryMoment(nodes[next].dataset.moment, true, { user: true });
        nodes[next].focus();
      });
      track.appendChild(node);
    }
    document.body.classList.add('story-mode');
    setInteractive($('console'), false);
    const storyline = $('storyline');
    storyline.classList.add('show');
    setInteractive(storyline, true);
    const initial = initialMomentId || experience.defaultMoment || experience.moments[0].id;
    this.selectStoryMoment(initial, true, initialMomentId ? { intro: true } : {});
  }
  selectStoryMoment(id, notify = true, meta = {}){
    if (!this._storyExperience) return;
    const moment = this._storyExperience.moments.find(m => m.id === id)
      || this._storyExperience.moments[0];
    const activeVisual = moment.visual || {};
    const activePresentation = activeVisual.presentation;
    const activeState = activeVisual.state;
    for (const button of document.querySelectorAll('#storyViewModes .story-view')){
      const viewMoment = this._storyExperience.moments.find(candidate =>
        candidate.id === button.dataset.moment);
      const viewVisual = viewMoment && viewMoment.visual || {};
      const active = activePresentation
        ? viewVisual.presentation === activePresentation
        : activeState != null
          ? viewVisual.state === activeState
          : button.dataset.moment === moment.id;
      button.classList.toggle('active', !!active);
      button.setAttribute('aria-pressed', String(!!active));
    }
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
    if (moment.source){
      source.href = moment.source;
      source.textContent = '↗';
      source.setAttribute('aria-label', 'Source for ' + moment.title);
      source.title = 'Open source';
      source.classList.remove('hidden');
    } else {
      source.removeAttribute('href');
      source.removeAttribute('aria-label');
      source.removeAttribute('title');
      source.classList.add('hidden');
    }
    if (activeNode){
      $('storyCopy').setAttribute('aria-labelledby', activeNode.id);
      this._scrollStoryNodeIntoView(activeNode);
    } else $('storyCopy').removeAttribute('aria-labelledby');
    if (notify && this._storySelect) this._storySelect(moment, meta);
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
    $('storyViewModes').classList.remove('show');
    setInteractive(storyline, false);
    setInteractive($('console'), true);
    this._storyExperience = null; this._storySelect = null;
  }

  /* ---- Solar System appearance epochs (not the orbital clock) ---- */
  showSolEpochs(epochs, onSelect){
    this._solEpochs = epochs;
    this._solEpochSelect = onSelect;
    const tabs = $('solEpochTabs');
    tabs.innerHTML = '';
    epochs.forEach((epoch, index) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'epoch-tab'; btn.dataset.epoch = epoch.id;
      btn.id = 'epoch-tab-' + epoch.id; btn.textContent = epoch.label || epoch.date;
      btn.setAttribute('role', 'tab'); btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', 'solEpochCopy'); btn.tabIndex = -1;
      btn.addEventListener('click', () => onSelect(epoch.id));
      btn.addEventListener('keydown', event => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % epochs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + epochs.length) % epochs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = epochs.length - 1;
        else return;
        event.preventDefault();
        onSelect(epochs[next].id);
        tabs.children[next].focus();
      });
      tabs.appendChild(btn);
    });
    const panel = $('solEpoch');
    panel.classList.add('show');
    document.body.classList.add('sol-epoch-visible');
    setInteractive(panel, true);
  }
  hideSolEpochs(){
    const panel = $('solEpoch');
    panel.classList.remove('show');
    document.body.classList.remove('sol-epoch-visible');
    setInteractive(panel, false);
  }
  setSolEpoch(epoch, bodyName = null){
    if (!epoch) return;
    let active = null;
    for (const tab of document.querySelectorAll('#solEpochTabs .epoch-tab')){
      const on = tab.dataset.epoch === epoch.id;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) active = tab;
    }
    const bodyEvidence = bodyName && epoch.bodyEvidence
      ? epoch.bodyEvidence[bodyName] : null;
    const copy = bodyEvidence || epoch;
    $('solEpochKind').textContent = epoch.phase || epoch.kind || '';
    $('solEpochTitle').textContent = copy.title || epoch.title || '';
    $('solEpochText').textContent = copy.text || epoch.text || '';
    $('solEpochLegend').textContent = copy.legend || epoch.legend || '';
    $('solEpochEvidence').textContent = [
      copy.evidence || epoch.evidence,
      bodyEvidence ? bodyEvidence.caveat : epoch.caveat,
    ].filter(Boolean).join(' ');
    const source = $('solEpochSource');
    source.href = copy.source || epoch.source || '#';
    source.textContent = (copy.sourceLabel || epoch.sourceLabel || 'SOURCE') + ' ↗';
    if (active) $('solEpochCopy').setAttribute('aria-labelledby', active.id);
  }
  setMode(mode){
    document.body.dataset.mode = mode;
    if (mode !== 'system') this.setInstrumentDrawerVisible(false);
    $('instrumentBtn').textContent = mode === 'system' ? 'DATA' : 'MORE';
    $('instrumentBtn').title = mode === 'system' ? 'Open system instruments' : 'Open atlas actions';
    $('instrumentTitle').textContent = mode === 'system' ? 'SYSTEM INSTRUMENTS' : 'ATLAS ACTIONS';
  }
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
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-pressed', 'false');
      const l = document.createElement('div'); l.className = 'l'; l.textContent = ev.label;
      const members = document.createElement('div');
      members.className = 'm';
      members.textContent = ev.members
        ? ev.members.map(name => name.slice(0, 3)).join(' · ') : '';
      const d = document.createElement('div'); d.className = 'd';
      if (ev.groupSize){
        d.append(document.createTextNode(
          ev.arcDeg.toFixed(1) + '° ARC · '));
      } else {
        d.append(document.createTextNode(ev.type + ' · '));
      }
      const date = document.createElement('b');
      date.textContent = ev.datePrecision === 'YEAR'
        ? '≈ ' + fmtDateAt(ev.t).slice(0, 4) + ' · MODEL PROJECTION'
        : fmtDateAt(ev.t);
      d.appendChild(date);
      item.title = [ev.members && ev.members.join(' · '), ev.caveat]
        .filter(Boolean).join('\n');
      item.appendChild(l);
      if (ev.members) item.appendChild(members);
      item.appendChild(d);
      const activate = () => {
        for (const sibling of list.querySelectorAll('.ev-item.active')){
          sibling.classList.remove('active');
          sibling.setAttribute('aria-pressed', 'false');
        }
        onJump(ev);
        item.classList.add('active');
        item.setAttribute('aria-pressed', 'true');
      };
      item.addEventListener('click', activate);
      item.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate();
      });
      list.appendChild(item);
    }
  }
  setMinimapVisible(on){
    $('mapFrame').classList.toggle('hidden', !on);
    $('photometer').classList.toggle('show', on);   // instruments travel together
  }
  /* ---- readouts + time console ---- */
  updateReadouts(time){
    const held = this.app._heldEvent;
    $('roDate').textContent = held && held.datePrecision === 'YEAR'
      ? '≈ ' + time.fmtDateAt(held.t).slice(0, 4) + ' · MODEL'
      : time.fmtDate();
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
    const clearHeldEvent = () => {
      app._heldEvent = null;
      for (const item of document.querySelectorAll('#evList .ev-item.active')){
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      }
    };
    const setRate = r => {
      time.setRate(r);
      if (time.rate !== 0) clearHeldEvent();
      this.syncTimeButtons(time.rate);
    };

    this._syncAudioButton();
    this._armAudioUnlock();
    document.addEventListener('click', event => {
      const target = event.target;
      const control = target && target.closest
        ? target.closest('button, [role="button"], .tour-btn, .ev-item, .cancel')
        : null;
      if (!control || control === $('audioBtn') || control.hasAttribute('disabled')) return;
      app.audio.button();
    }, true);

    $('scrub').addEventListener('input', e => {
      time.setRate(time.scrubToRate(parseFloat(e.target.value)));
      if (time.rate !== 0) clearHeldEvent();
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
    $('contextHintClose').addEventListener('click', () => this.hideContextHint());
  }

  /* ---- ambient soundscape + UI sounds (see core AudioEngine) ---- */
  _syncAudioButton(available = true){
    const btn = $('audioBtn');
    if (!available){
      btn.textContent = 'SOUND N/A';
      btn.classList.remove('on');
      btn.setAttribute('aria-pressed', 'false');
      btn.disabled = true;
      return;
    }
    const on = this.app.audio.enabled;
    btn.disabled = false;
    btn.textContent = on ? 'SOUND ON' : 'SOUND OFF';
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }

  _armAudioUnlock(){
    const audioButton = $('audioBtn');
    const cleanup = () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    const unlock = event => {
      if (event.target === audioButton || audioButton.contains(event.target)) return;
      if (!this.app.audio.enabled){ cleanup(); return; }
      const ok = this.app.audio.unlock();
      if (!ok) this._syncAudioButton(false);
      cleanup();
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  _toggleAudio(){
    const turningOn = !this.app.audio.enabled;
    if (!turningOn) this.app.audio.button();
    const ok = this.app.audio.setEnabled(turningOn);
    if (!ok){ this._syncAudioButton(false); return; }
    this._syncAudioButton();
    if (turningOn) this.app.audio.button();
  }
}
