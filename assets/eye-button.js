// Pupils in `.eye-button` track the pointer (or the last touch). Copy feedback is driven
// by the existing #copy-status live region so the clipboard logic stays in portfolio.js.
(() => {
  const button = document.querySelector('.eye-button');
  if (!button) return;
  const eyes = [...button.querySelectorAll('.eye')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pointer = null;
  let raf = 0;

  function look() {
    raf = 0;
    if (!pointer || reduced.matches || button.hidden) return;
    for (const eye of eyes) {
      const pupil = eye.firstElementChild;
      const r = eye.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height / 2);
      const reach = (r.width - pupil.offsetWidth) / 2 - 2;
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(reach, dist * .18) / dist; // ease in close to the eye, cap at the rim
      pupil.style.setProperty('--px', `${dx * k}px`);
      pupil.style.setProperty('--py', `${dy * k}px`);
    }
  }
  const queue = e => {
    pointer = { x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(look);
  };
  addEventListener('pointermove', queue, { passive: true });
  addEventListener('pointerdown', queue, { passive: true });

  // With no pointer (touch), the eyes glance around on their own until the first touch.
  if (!matchMedia('(hover: hover)').matches) {
    const spots = [[-1, .2], [1, -.3], [.3, 1], [-.6, -1], [1, .4]];
    let i = 0;
    setInterval(() => {
      if (reduced.matches || document.hidden || document.body.classList.contains('motion-paused')) return;
      const r = button.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const [x, y] = spots[i++ % spots.length];
      pointer = { x: r.left + r.width / 2 + x * 200, y: r.top + r.height / 2 + y * 200 };
      look();
    }, 1400);
  }

  const status = document.querySelector('#copy-status');
  if (status) {
    let timer;
    new MutationObserver(() => {
      if (!/copied\.?$/i.test(status.textContent.trim()) || /could not/i.test(status.textContent)) return;
      button.dataset.copied = '';
      clearTimeout(timer);
      timer = setTimeout(() => delete button.dataset.copied, 2200);
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }
})();
