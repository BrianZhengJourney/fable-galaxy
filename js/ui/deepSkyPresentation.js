/* Flat observation -> WebGL model presentation controller.
   This module owns only DOM state. The actual scientific 3D reconstruction
   remains the existing scene rendered in #stage underneath this layer. */

const ACTIVE_CLASS = 'deep-sky-presentation';
const SPLIT_CLASS = 'deep-sky-split';

function imageRecord(image){
  if (typeof image === 'string') return { file: image, credit: '', alt: '' };
  if (!image || typeof image.file !== 'string') return null;
  return {
    file: image.file,
    credit: image.credit || '',
    alt: image.alt || '',
  };
}

function entryName(entry){
  return entry && (entry.name || entry.title || entry.designation) || 'Deep-sky object';
}

export class DeepSkyPresentation {
  constructor(){
    this.root = document.getElementById('deepSkyPresentation');
    if (!this.root) throw new Error('Missing #deepSkyPresentation mount');

    this.observationImage = document.getElementById('dspObservationImage');
    this.splitImage = document.getElementById('dspSplitImage');
    this.observationLabel = document.getElementById('dspObservationLabel');
    this.splitLabel = document.getElementById('dspSplitLabel');
    this.observationCredit = document.getElementById('dspObservationCredit');
    this.splitCredit = document.getElementById('dspSplitCredit');
    this.splitFigure = this.root.querySelector('.dsp-split-observation');
    this.status = document.getElementById('dspStatus');

    this._ready = false;
    this._durationMs = 4200;
    this._loadToken = 0;
    this._pendingLoad = null;
  }

  get ready(){ return this._ready; }

  /**
   * Load one exact local observation and reset the presentation to its full,
   * head-on image. Resolves true after the source image has decoded enough to
   * display; resolves false when the source cannot be loaded.
   */
  prepare({ entry, image, durationMs } = {}){
    const record = imageRecord(image);
    if (!record) throw new TypeError('DeepSkyPresentation.prepare requires a local image file');

    this.clear();
    const token = ++this._loadToken;
    const name = entryName(entry);
    const fullAlt = record.alt || `${name} source observation`;
    const splitAlt = record.alt || `${name} source observation beside the 3D model`;
    const duration = Number(durationMs);
    this._durationMs = Number.isFinite(duration) && duration >= 0 ? duration : 4200;
    this.root.style.setProperty('--dsp-reveal-duration', `${this._durationMs}ms`);
    this.root.style.setProperty('--dsp-fade-duration', `${Math.round(this._durationMs * .72)}ms`);
    this.root.setAttribute('aria-label', `${name}: observation and 3D model presentation`);
    this.observationImage.alt = fullAlt;
    this.splitImage.alt = splitAlt;
    this.observationLabel.textContent = `${name} · OBSERVATION`;
    this.splitLabel.textContent = `${name} · OBSERVATION`;
    this.observationCredit.textContent = record.credit;
    this.splitCredit.textContent = record.credit;
    this.splitFigure.setAttribute('aria-label', `${name}: flat source observation beside the 3D model`);
    this.showObservation();
    this.status.textContent = `Loading ${name} observation`;

    return new Promise(resolve => {
      const finish = value => {
        if (this._pendingLoad === finish) this._pendingLoad = null;
        resolve(value);
      };
      this._pendingLoad = finish;
      this.observationImage.onload = () => {
        if (token !== this._loadToken) return finish(false);
        this._ready = true;
        this.root.dataset.ready = 'true';
        this.status.textContent = `${name} observation`;
        finish(true);
      };
      this.observationImage.onerror = () => {
        if (token !== this._loadToken) return finish(false);
        this._ready = false;
        this.root.dataset.ready = 'false';
        this.status.textContent = `${name} observation unavailable`;
        finish(false);
      };
      // Both elements point to the same untouched source. The right-hand copy
      // is never transformed, filtered, or cropped in split mode.
      this.observationImage.src = record.file;
      this.splitImage.src = record.file;
    });
  }

  showObservation(){
    this._setMode('observation');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.querySelector('.dsp-reveal').setAttribute('aria-hidden', 'false');
    this.splitFigure.setAttribute('aria-hidden', 'true');
    document.body.classList.add(ACTIVE_CLASS);
    document.body.classList.remove(SPLIT_CLASS);
    this.status.textContent = `${this._nameFromLabel()} observation`;
  }

  beginReveal(){
    this._setMode('revealing');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.querySelector('.dsp-reveal').setAttribute('aria-hidden', 'true');
    this.splitFigure.setAttribute('aria-hidden', 'true');
    document.body.classList.add(ACTIVE_CLASS);
    document.body.classList.remove(SPLIT_CLASS);
    this.status.textContent = `Transitioning from observation to 3D model`;
  }

  showSplit(){
    this._setMode('split');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.querySelector('.dsp-reveal').setAttribute('aria-hidden', 'true');
    this.splitFigure.setAttribute('aria-hidden', 'false');
    document.body.classList.add(ACTIVE_CLASS, SPLIT_CLASS);
    this.status.textContent = `3D model beside ${this._nameFromLabel()} observation`;
  }

  showModel(){
    this._setMode('model');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.querySelector('.dsp-reveal').setAttribute('aria-hidden', 'true');
    this.splitFigure.setAttribute('aria-hidden', 'true');
    document.body.classList.remove(ACTIVE_CLASS, SPLIT_CLASS);
    this.status.textContent = '3D model';
  }

  clear(){
    if (this._pendingLoad){
      const finish = this._pendingLoad;
      this._pendingLoad = null;
      finish(false);
    }
    this._loadToken += 1;
    this._ready = false;
    this._setMode('clear');
    this.root.dataset.ready = 'false';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.querySelector('.dsp-reveal').setAttribute('aria-hidden', 'true');
    this.splitFigure.setAttribute('aria-hidden', 'true');
    document.body.classList.remove(ACTIVE_CLASS, SPLIT_CLASS);
    this.observationImage.onload = null;
    this.observationImage.onerror = null;
    this.observationImage.removeAttribute('src');
    this.splitImage.removeAttribute('src');
    this.observationImage.alt = '';
    this.splitImage.alt = '';
    this.observationCredit.textContent = '';
    this.splitCredit.textContent = '';
    this.status.textContent = '';
  }

  _setMode(mode){ this.root.dataset.mode = mode; }

  _nameFromLabel(){
    return this.observationLabel.textContent.replace(/\s*·\s*OBSERVATION\s*$/, '') || 'Deep-sky object';
  }
}
