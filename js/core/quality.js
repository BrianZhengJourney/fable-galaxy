/* Device tiering + adaptive quality.
   detectTier() picks a texture tier once, from real GPU capability (max
   texture size), form factor and memory — so weak/mobile devices download
   and hold 2K maps instead of 8K. Override with ?tier=low|high or
   localStorage '47-tier'. QualityManager then watches frame time and steps
   DPR (and finally bloom) down when the GPU can't hold 60fps, back up when
   it can — so it stays smooth and cool across very different hardware. */

let _tier = null;

export function detectTier(){
  if (_tier) return _tier;

  // manual override (URL query or localStorage) — also a user-facing knob
  let forced = null;
  try{
    forced = new URLSearchParams(location.search).get('tier')
             || localStorage.getItem('47-tier')
             || localStorage.getItem('epocharium-tier')
             || localStorage.getItem('fg-tier');
  }catch(e){ /* ignore */ }
  if (forced === 'low' || forced === 'high'){
    _tier = { tier: forced, maxDpr: forced === 'high' ? 1.5 : 1.25, forced: true };
    return _tier;
  }

  // probe a throwaway GL context for the real hardware limit
  let maxTex = 4096;
  try{
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl){
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  }catch(e){ /* ignore */ }

  const ua = navigator.userAgent || '';
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    || (navigator.userAgentData && navigator.userAgentData.mobile);
  const lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;

  // 8K needs a ≥8192 texture unit; skip it on phones and low-RAM machines
  const high = maxTex >= 8192 && !mobile && !lowMem;
  _tier = {
    tier: high ? 'high' : 'low',
    maxDpr: high ? 1.5 : (mobile ? 1.0 : 1.25),
    maxTex, mobile: !!mobile, lowMem
  };
  return _tier;
}

export const TEX_TIER = detectTier().tier;

/* ---- adaptive quality: DPR + bloom follow measured frame time ---- */
export class QualityManager {
  constructor(app){
    this.app = app;
    const maxDpr = detectTier().maxDpr;
    // ordered best → worst; each step is a real GPU-load reduction
    this.levels = [
      { dpr: maxDpr, bloom: true },
      { dpr: Math.max(1.0, Math.min(maxDpr, 1.25)), bloom: true },
      { dpr: 1.0, bloom: true },
      { dpr: 1.0, bloom: false }
    ];
    this.level = 0;
    this.emaMs = 16;
    this.frames = 0;
    this.apply();
  }

  get bloom(){ return this.levels[this.level].bloom; }

  /* call once per real (visible) frame with the frame delta in ms */
  sample(dtMs){
    this.emaMs = this.emaMs * 0.9 + dtMs * 0.1;
    if (++this.frames < 90) return;          // ~1.5 s decision window
    this.frames = 0;
    if (this.emaMs > 30 && this.level < this.levels.length - 1){
      this.level++; this.apply();            // sustained <~33 fps → step down
    } else if (this.emaMs < 20 && this.level > 0){
      this.level--; this.apply();            // comfortably fast → step back up
    }
  }

  apply(){
    const dpr = this.levels[this.level].dpr;
    const r = this.app.renderer;
    r.setPixelRatio(dpr);
    r.setSize(this.app.W, this.app.H);
    const c = this.app.composer;
    if (c){
      if (c.setPixelRatio) c.setPixelRatio(dpr);
      c.setSize(this.app.W, this.app.H);
    }
  }

  onResize(){ this.apply(); }
}
