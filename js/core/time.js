/* Simulation clock. simDays is the single source of truth for every orbit,
   spin and comet in whatever system is loaded; rates are days-per-real-second
   on a symmetric exponential scrubber, so reverse works by construction. */

export class TimeSystem {
  constructor(){
    this.simDays = 0;
    this.rate = 10;                                   // days per real second
    this.EPOCH = Date.UTC(2026, 6, 2);
    this.MAX_RATE = (Math.pow(10, 3.5) - 1) / 2;      // ≈ 1580 d/s at scrubber ends
  }
  advance(dt){ this.simDays += this.rate * dt; }

  setRate(r){ this.rate = Math.max(-this.MAX_RATE, Math.min(this.MAX_RATE, r)); }

  scrubToRate(v){                                     // slider [-100,100] → rate
    const a = Math.abs(v) / 100;
    return Math.sign(v) * (Math.pow(10, a * 3.5) - 1) / 2;
  }
  rateToScrub(){
    const a = Math.log10(Math.abs(this.rate) * 2 + 1) / 3.5;
    return Math.sign(this.rate) * Math.min(1, a) * 100;
  }

  fmtRate(){
    const ts = this.rate, a = Math.abs(ts);
    if (ts === 0) return 'HOLD';
    const s = a >= 365 ? (a / 365.25).toFixed(1) + ' yr/s'
            : a >= 10 ? a.toFixed(0) + ' d/s'
            : a.toFixed(1) + ' d/s';
    return (ts < 0 ? '−' : '') + '×' + s;
  }
  fmtDate(){
    const d = new Date(this.EPOCH + this.simDays * 86400000);
    if (isNaN(d.getTime())) return '····-··-··';
    const p = n => (n < 10 ? '0' : '') + n;
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
           ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
  }
  fmtElapsed(){
    const days = this.simDays, a = Math.abs(days), sign = days < 0 ? 'T−' : 'T+';
    if (a < 60)  return sign + ' ' + a.toFixed(1) + ' d';
    if (a < 730) return sign + ' ' + (a / 30.44).toFixed(1) + ' mo';
    return sign + ' ' + (a / 365.25).toFixed(1) + ' yr';
  }
}
