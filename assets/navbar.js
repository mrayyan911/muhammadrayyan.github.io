(() => {
  const header = document.querySelector('.glass-nav');
  if (!header) return;
  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('nav');
  const mobile = matchMedia('(max-width: 760px)');
  function setOpen(open, restoreFocus = false) {
    header.toggleAttribute('data-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (restoreFocus) toggle.focus();
  }
  header.classList.add('nav-ready');
  toggle.hidden = false;
  toggle.addEventListener('click', () => setOpen(!header.hasAttribute('data-open')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.hasAttribute('data-open')) setOpen(false, true);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setOpen(false);
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) setOpen(false, mobile.matches);
  });
  mobile.addEventListener('change', () => {
    const wasFocused = document.activeElement;
    setOpen(false);
    if (mobile.matches && nav.contains(wasFocused)) toggle.focus();
    else if (!mobile.matches && wasFocused === toggle) nav.querySelector('a').focus();
  });

  nav.addEventListener('pointermove', event => {
    const link = event.target.closest('a');
    if (!link) return;
    const box = link.getBoundingClientRect();
    link.style.setProperty('--lx', `${event.clientX - box.left}px`);
    link.style.setProperty('--ly', `${event.clientY - box.top}px`);
  });

  const sectionLinks = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = sectionLinks.map(link => document.querySelector(link.hash)).filter(Boolean);
  let queued = false;
  function updateCurrent() {
    queued = false;
    const current = sections.filter(section => section.getBoundingClientRect().top <= 160)
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
    sectionLinks.forEach(link => {
      if (current && link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(updateCurrent); }
  }, { passive: true });
  updateCurrent();
})();
