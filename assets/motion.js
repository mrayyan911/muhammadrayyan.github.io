// Progressive motion: content stays visible without JavaScript or observers.
(() => {
  const hero = document.querySelector('.cohesion-hero');
  if (!hero) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('.motion-toggle');
  const active = new Set();
  let paused = false;
  let observer;

  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
  }

  function reveal(element) {
    if (element.matches('.about-portrait')) {
      animate(element, [
        { opacity: 0, transform: 'perspective(900px) translateY(65px) rotateX(55deg) rotate(-9deg)' },
        { opacity: 1, transform: 'perspective(900px) translateY(0) rotateX(0) rotate(-4deg)' },
      ], { duration: 1100, easing: 'cubic-bezier(.16,1,.3,1)' });
    } else {
      animate(element, [
        { opacity: 0, transform: 'translateY(32px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 850, delay: Number(element.dataset.revealDelay || 0), easing: 'cubic-bezier(.16,1,.3,1)' });
    }
  }

  function sync() {
    const disabled = preference.matches || paused;
    document.body.classList.toggle('motion-paused', disabled);
    toggle.hidden = preference.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Resume animation' : 'Pause animation';
    observer?.disconnect();
    active.forEach(animation => animation.cancel());
    active.clear();
    if (disabled || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target;
        observer.unobserve(element);
        if (element.dataset.revealed) continue;
        element.dataset.revealed = 'true';
        reveal(element);
      }
    }, { threshold: 0.15 });
    document.querySelectorAll('.about-portrait, .about-copy > *, .section-heading, .skill-row').forEach((element, index) => {
      element.dataset.revealDelay = String(element.matches('.skill-row') ? (index % 4) * 70 : 0);
      observer.observe(element);
    });
  }

  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  preference.addEventListener('change', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      hero.classList.toggle('motion-offscreen', !entry.isIntersecting);
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('motion-hidden', document.hidden);
  });

  // Scroll-linked depth: each shape drifts and spins at its own rate, and the name slides sideways.
  // Uses the independent `translate`/`rotate` properties so the idle float keyframes keep running.
  const layers = [
    ['.shape-cone', -0.22, 0.07], ['.shape-orb', 0.12, -0.05], ['.shape-capsule', 0.3, -0.09],
    ['.shape-donut', -0.32, 0.1], ['.shape-cube', 0.2, 0.08], ['.shape-plus', -0.16, -0.12],
  ].map(([selector, drift, spin]) => ({ element: hero.querySelector(selector), drift, spin })).filter(l => l.element);
  const marquee = hero.querySelector('.hero-marquee');
  let target = 0, current = 0, frame = 0;

  function paint() {
    frame = 0;
    current += (target - current) * 0.12;
    for (const { element, drift, spin } of layers) {
      element.style.translate = `0 ${(current * drift).toFixed(1)}px`;
      element.style.rotate = `${(current * spin).toFixed(2)}deg`;
    }
    if (marquee) marquee.style.translate = `${(current * -0.35).toFixed(1)}px 0`;
    if (Math.abs(target - current) > 0.1) frame = requestAnimationFrame(paint);
  }
  function onScroll() {
    target = document.body.classList.contains('motion-paused') ? 0 : Math.min(scrollY, 1000);
    if (!frame) frame = requestAnimationFrame(paint);
  }
  addEventListener('scroll', onScroll, { passive: true });
  toggle.addEventListener('click', onScroll);
  preference.addEventListener('change', onScroll);
  onScroll();
  sync();
  onScroll();
})();
