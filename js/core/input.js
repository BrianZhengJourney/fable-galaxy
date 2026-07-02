/* Pointer + keyboard input, decoupled from what's on screen.
   The app supplies callbacks; drag-vs-click is disambiguated here. */

export class Input {
  constructor(el, handlers){
    this.el = el;
    this.h = handlers;   // { drag(dx,dy), wheel(dy), click(x,y), hover(x,y), key(code) }
    this.dragging = false;
    this.moved = 0;
    this.px = 0; this.py = 0;
    this._wire();
  }

  _wire(){
    const el = this.el, h = this.h;

    el.addEventListener('mousedown', e => {
      this.dragging = true; this.moved = 0;
      this.px = e.clientX; this.py = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (this.dragging){
        const dx = e.clientX - this.px, dy = e.clientY - this.py;
        this.moved += Math.abs(dx) + Math.abs(dy);
        h.drag(dx, dy);
        this.px = e.clientX; this.py = e.clientY;
      } else {
        h.hover(e.clientX, e.clientY);
      }
    });
    window.addEventListener('mouseup', e => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.moved < 6) h.click(e.clientX, e.clientY);
    });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      h.wheel(e.deltaY);
    }, { passive: false });

    el.addEventListener('touchstart', e => {
      if (e.touches.length === 1){
        this.dragging = true; this.moved = 0;
        this.px = e.touches[0].clientX; this.py = e.touches[0].clientY;
      }
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (this.dragging && e.touches.length === 1){
        const dx = e.touches[0].clientX - this.px, dy = e.touches[0].clientY - this.py;
        this.moved += Math.abs(dx) + Math.abs(dy);
        h.drag(dx, dy);
        this.px = e.touches[0].clientX; this.py = e.touches[0].clientY;
      }
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (this.dragging && this.moved < 8 && e.changedTouches.length){
        const t = e.changedTouches[0];
        h.click(t.clientX, t.clientY);
      }
      this.dragging = false;
    });

    window.addEventListener('keydown', e => h.key(e));
  }
}
