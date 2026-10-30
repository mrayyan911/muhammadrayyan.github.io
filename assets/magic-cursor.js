(() => {
  if (window.__magicCursor) return;
  window.__magicCursor = true;

  const E = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const LINK = 'a, button, [role=button], summary, label, .liquid-button, .eye-button';
  const TEXT = 'input, textarea, select, [contenteditable]';
  const ARROW = 'M42.6817 41.1495L27.5103 6.79925C26.7269 5.02557 24.2082 5.02558 23.3927 6.79925L7.59814 41.1495C6.75833 42.9759 8.52712 44.8902 10.4125 44.1954L24.3757 39.0496C24.8829 38.8627 25.4385 38.8627 25.9422 39.0496L39.8121 44.1954C41.6849 44.8902 43.4884 42.9759 42.6817 41.1495Z';
  const CSS = `
html.has-magic-cursor, html.has-magic-cursor * { cursor: none !important }
html.has-magic-cursor input, html.has-magic-cursor textarea, html.has-magic-cursor select,
html.has-magic-cursor [contenteditable], html.has-magic-cursor [data-cursor="native"],
html.has-magic-cursor [data-cursor="native"] * { cursor: auto !important }
.magic-cursor { position: fixed; left: 0; top: 0; width: 40px; height: 40px; margin: -20px 0 0 -20px;
  pointer-events: none; z-index: 2147483000; will-change: transform; opacity: 0; transition: opacity .2s ${E} }
.magic-cursor[data-state="default"], .magic-cursor[data-state="link"],
.magic-cursor[data-state="press"], .magic-cursor[data-state="aim"] { opacity: 1 }
.magic-cursor svg { position: absolute; inset: 0; transition: transform .25s ${E}, opacity .25s ${E} }
.magic-cursor .mc-accent { opacity: 0; transition: opacity .25s ${E} }
.magic-cursor[data-state="link"] svg { transform: scale(1.2) }
.magic-cursor[data-state="link"] .mc-accent { opacity: 1 }
.magic-cursor[data-state="press"] svg { transform: scale(.86) }
.magic-cursor .mc-ring { position: absolute; left: 8px; top: 8px; width: 24px; height: 24px; box-sizing: border-box;
  border: 1.5px solid #12141a; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(245,246,248,.85);
  opacity: 0; transform: scale(.6); transition: transform .25s ${E}, opacity .25s ${E} }
.magic-cursor .mc-ring::after { content: ""; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px;
  margin: -2px 0 0 -2px; border-radius: 50%; background: #12141a }
.magic-cursor[data-state="aim"] .mc-ring { opacity: 1; transform: scale(1) }
.magic-cursor[data-state="aim"] svg { opacity: 0; transform: scale(.6) }
@media (prefers-reduced-motion: reduce) {
  .magic-cursor, .magic-cursor svg, .magic-cursor .mc-accent, .magic-cursor .mc-ring { transition: none !important }
}`;
  const SVG = `<svg viewBox="0 0 50 54" width="40" height="40" aria-hidden="true">
<defs><filter id="magic-cursor-shadow" filterUnits="userSpaceOnUse" x="-5" y="-5" width="60" height="64">
<feDropShadow dx="0" dy="2.26" stdDeviation="1.13" flood-color="#000" flood-opacity=".08"/></filter></defs>
<g filter="url(#magic-cursor-shadow)" stroke="#fff" stroke-width="4.5" stroke-linejoin="round" paint-order="stroke">
<path d="${ARROW}" fill="#12141a"/><path class="mc-accent" d="${ARROW}" fill="#25695a"/></g></svg>
<div class="mc-ring"></div>`;

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let el, styleEl, started, raf;
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, heading = 0, target = 0;
  let base = 'default', pressed = false, hidden = false;

  const render = () => {
    el.dataset.state = hidden ? 'hidden'
      : pressed && (base === 'default' || base === 'link') ? 'press' : base;
  };

  const classify = (t) => {
    if (!(t instanceof Element)) return 'default';
    if (t.closest('[data-cursor="native"]')) return 'native';
    if (t.closest(TEXT)) return 'text';
    if (t.closest('[data-cursor="aim"]')) return 'aim';
    return t.closest(LINK) ? 'link' : 'default';
  };

  const tick = () => {
    const snap = reduced.matches;
    const k = snap ? 1 : 0.22;
    const nx = x + (tx - x) * k, ny = y + (ty - y) * k;
    vx += (nx - x - vx) * 0.3;
    vy += (ny - y - vy) * 0.3;
    x = nx; y = ny;
    // +90deg because the arrow path points up, not along +x
    if (Math.hypot(vx, vy) > 0.8) target = Math.atan2(vy, vx) * 180 / Math.PI + 90;
    const d = ((target - heading + 540) % 360) - 180;
    heading += snap ? d : d * 0.18;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${heading}deg)`;
    const settled = Math.hypot(tx - x, ty - y) < 0.1 && Math.abs(d) < 0.2;
    raf = settled ? 0 : requestAnimationFrame(tick);
  };

  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    tx = e.clientX; ty = e.clientY;
    if (!started) {
      started = true;
      x = tx; y = ty;
      document.documentElement.classList.add('has-magic-cursor');
      base = classify(e.target);
    }
    if (hidden) { hidden = false; render(); }
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const onOver = (e) => { base = classify(e.target); render(); };
  const onOut = (e) => { if (!e.relatedTarget) { hidden = true; render(); } };
  const onDown = () => { pressed = true; render(); };
  const onUp = () => { pressed = false; render(); };
  const onBlur = () => { hidden = true; pressed = false; render(); };

  const on = (add) => {
    const m = add ? 'addEventListener' : 'removeEventListener';
    document[m]('pointermove', onMove, { passive: true });
    document[m]('pointerover', onOver);
    document[m]('pointerout', onOut);
    document[m]('pointerdown', onDown);
    document[m]('pointerup', onUp);
    document[m]('pointercancel', onUp);
    window[m]('blur', onBlur);
  };

  const enable = () => {
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    el = document.createElement('div');
    el.className = 'magic-cursor';
    el.innerHTML = SVG;
    hidden = true; pressed = false; base = 'default'; started = false;
    render();
    document.head.append(styleEl);
    document.body.append(el);
    on(true);
  };

  const disable = () => {
    on(false);
    cancelAnimationFrame(raf); raf = 0;
    document.documentElement.classList.remove('has-magic-cursor');
    el.remove(); styleEl.remove(); el = styleEl = null;
  };

  const sync = () => {
    if (fine.matches && !el) enable();
    else if (!fine.matches && el) disable();
  };
  const init = () => { sync(); fine.addEventListener('change', sync); };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
