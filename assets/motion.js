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
  sync();
})();
