(() => {
  const cta = document.querySelector('.sticky-cta');
  const hero = document.querySelector('.actions');
  const ends = [document.querySelector('.contact-section'), document.querySelector('.site-footer')];
  if (!cta || !hero || !('IntersectionObserver' in window)) return;
  const hidden = { hero: true, ends: false };
  const update = () => cta.classList.toggle('is-visible', !hidden.hero && !hidden.ends);
  // The bar shows once the hero CTA has scrolled away and hides again at the contact block.
  new IntersectionObserver(([e]) => { hidden.hero = e.isIntersecting || e.boundingClientRect.top > 0; update(); }).observe(hero);
  const seen = new Set();
  const endObserver = new IntersectionObserver(entries => {
    entries.forEach(e => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
    hidden.ends = seen.size > 0;
    update();
  });
  ends.forEach(el => el && endObserver.observe(el));
})();
