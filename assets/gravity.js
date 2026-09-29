// The contact section's "Don't press this" button drops the homepage into a physics pile.
// Matter.js loads on first hover or press. "Put it back" or Escape restores the page.
(() => {
  const button = document.querySelector('.gravity-button');
  if (!button) return;
  const MATTER = new URL('vendor/matter-js@0.19.0/matter.min.js', document.currentScript.src).href;

  // Each match falls as one piece; a match inside another match falls with its parent.
  const PIECES = [
    '.site-header',
    '#hero-title', '.hero-greeting p', '.hero-stage .shape', '.hero-portrait', '.hero-sticker',
    '.hero-invitation p', '.hero-invitation a', '.hero-footnote span',
    '.section-heading', '.project', '.more-work', '.experience-row',
    '.toolkit-title', '.logo-row',
    '.about-section .eyebrow', '.about-portrait', '.about-copy > *',
    '.contact-heading h2', '.mail-note', '.contact-bottom > div > *',
    '.footer-avatar', '.site-footer > .mono', '.site-footer > div > *',
  ].join(',');

  // Collision outlines that follow the hero artwork instead of its square SVG box.
  const SHAPES = {
    '.shape-orb': (w, h, o) => Matter.Bodies.circle(0, 0, w * 0.46, o),
    '.shape-donut': (w, h, o) => Matter.Bodies.circle(0, 0, w * 0.435, o),
    '.shape-capsule': (w, h, o) => Matter.Bodies.rectangle(0, 0, w * 0.42, h * 0.92, { ...o, chamfer: { radius: w * 0.2 } }),
    '.shape-cube': (w, h, o) => Matter.Bodies.polygon(0, 0, 6, w * 0.42, o),
    '.shape-cone': (w, h, o) => Matter.Bodies.trapezoid(0, 0, w * 0.9, h * 0.85, 0.9, o),
    '.shape-plus': (w, h, o) => Matter.Body.create({ ...o, parts: [
      Matter.Bodies.rectangle(0, 0, w * 0.26, h * 0.86, { chamfer: { radius: w * 0.12 } }),
      Matter.Bodies.rectangle(0, 0, w * 0.86, h * 0.26, { chamfer: { radius: w * 0.12 } }),
    ] }),
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const syncVisibility = () => { button.hidden = reduced.matches; };
  reduced.addEventListener('change', syncVisibility);
  syncVisibility();

  let loading = null;
  function loadMatter() {
    if (window.Matter) return Promise.resolve();
    loading ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = MATTER;
      script.onload = resolve;
      script.onerror = () => { loading = null; script.remove(); reject(new Error('Matter.js failed to load')); };
      document.head.append(script);
    });
    return loading;
  }
  // Restart the shine sweep on every press, from a pointer or the keyboard.
  const shine = () => {
    button.removeAttribute('data-shine');
    void button.offsetWidth;
    button.setAttribute('data-shine', '');
  };
  button.addEventListener('pointerdown', shine);
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') shine(); });
  button.addEventListener('animationend', () => button.removeAttribute('data-shine'));

  button.addEventListener('pointerenter', () => loadMatter().catch(() => {}), { once: true });
  button.addEventListener('focus', () => loadMatter().catch(() => {}), { once: true });

  let dropped = false;
  button.addEventListener('click', async () => {
    if (dropped || reduced.matches) return;
    dropped = true;
    try {
      await loadMatter();
    } catch {
      dropped = false;
      return;
    }
    drop();
  });

  // position: fixed is relative to the nearest ancestor with one of these, not to the viewport.
  function trapsFixed(cs) {
    return cs.transform !== 'none' || cs.perspective !== 'none' || cs.filter !== 'none' ||
      cs.translate !== 'none' || cs.rotate !== 'none' || cs.scale !== 'none' ||
      (cs.backdropFilter || 'none') !== 'none' || (cs.webkitBackdropFilter || 'none') !== 'none' ||
      /paint|layout|strict|content/.test(cs.contain) || /transform|perspective|filter/.test(cs.willChange) ||
      (cs.containerType || 'normal') !== 'normal';
  }

  // Plain text blocks collide by their text, not by the full column they sit in.
  function isBareText(el, cs) {
    return el instanceof HTMLElement && cs.display !== 'flex' && cs.display !== 'grid' &&
      cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' && cs.boxShadow === 'none' &&
      ['Top', 'Right', 'Bottom', 'Left'].every(side =>
        parseFloat(cs['padding' + side]) === 0 && parseFloat(cs['border' + side + 'Width']) === 0);
  }

  function angleOf(cs) {
    let angle = 0;
    const matrix = cs.transform.match(/matrix(?:3d)?\(([^)]+)\)/);
    if (matrix) {
      const [a, b] = matrix[1].split(',').map(Number);
      angle = Math.atan2(b, a);
    }
    if (cs.rotate && cs.rotate !== 'none') angle += (parseFloat(cs.rotate.split(' ').pop()) || 0) * Math.PI / 180;
    return angle;
  }

  function measure(el, viewHeight) {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const cs = getComputedStyle(el);
    // Layout size, not the bounding box, which grows when the element is rotated.
    let w = el instanceof HTMLElement ? el.offsetWidth : parseFloat(cs.width);
    let h = el instanceof HTMLElement ? el.offsetHeight : parseFloat(cs.height);
    let cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    if (isBareText(el, cs)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      if (text.width && text.height) {
        w = Math.ceil(text.width) + 2;
        h = Math.ceil(text.height);
        cx = text.left + text.width / 2;
        cy = text.top + text.height / 2;
      }
    }
    const raw = cs.borderTopLeftRadius;
    let radius = parseFloat(raw) || 0;
    if (raw.endsWith('%')) radius = radius / 100 * Math.min(w, h);
    return {
      el, w, h, cx, cy,
      angle: angleOf(cs),
      radius: Math.min(radius, w / 2, h / 2),
      visible: box.bottom > 0 && box.top < viewHeight,
    };
  }

  function makeBody(piece, scale) {
    const { Bodies } = Matter;
    const w = piece.w * scale, h = piece.h * scale;
    const options = { restitution: 0.3, friction: 0.4, frictionAir: 0.01 };
    const shape = Object.keys(SHAPES).find(selector => piece.el.matches(selector));
    if (shape) return SHAPES[shape](w, h, options);
    const radius = piece.radius * scale;
    if (Math.abs(w - h) < 2 && radius >= w / 2 - 1) return Bodies.circle(0, 0, w / 2, options);
    const chamfer = Math.min(radius, Math.min(w, h) / 2 - 0.5);
    return Bodies.rectangle(0, 0, w, h, chamfer > 1 ? { ...options, chamfer: { radius: chamfer } } : options);
  }

  function render(piece) {
    const { position, angle } = piece.body;
    piece.el.style.transform =
      `translate(${position.x - piece.w / 2}px, ${position.y - piece.h / 2}px) rotate(${angle}rad) scale(${piece.scale})`;
  }

  function drop() {
    const { Engine, Runner, Bodies, Body, Composite, Events } = Matter;
    const root = document.documentElement;
    const W = root.clientWidth, H = root.clientHeight;
    const saved = new Map();
    const keep = el => { if (!saved.has(el)) saved.set(el, el.getAttribute('style')); };
    // Fixed pieces leave the page short, which clamps the scroll position; restore puts it back.
    const scrollTop = scrollY;

    // Measure every piece before changing any layout.
    const pieces = [...document.querySelectorAll(PIECES)]
      .filter(el => !el.parentElement.closest(PIECES))
      .map(el => measure(el, H))
      .filter(Boolean);

    // Shrink the pieces that rain in from off screen so the whole page fits in one pile.
    const area = list => list.reduce((sum, p) => sum + p.w * p.h, 0);
    const offscreen = pieces.filter(p => !p.visible);
    const budget = Math.max(W * H * 0.7 - area(pieces.filter(p => p.visible)), W * H * 0.35);
    const shrink = Math.min(1, Math.sqrt(budget / (area(offscreen) || 1)));

    for (const piece of pieces) {
      for (let el = piece.el.parentElement; el && el !== root; el = el.parentElement) {
        if (saved.has(el) || !trapsFixed(getComputedStyle(el))) continue;
        keep(el);
        Object.assign(el.style, {
          transform: 'none', translate: 'none', rotate: 'none', scale: 'none', perspective: 'none',
          filter: 'none', backdropFilter: 'none', webkitBackdropFilter: 'none', contain: 'none',
          willChange: 'auto', containerType: 'normal',
        });
      }
    }

    const engine = Engine.create();
    engine.gravity.y = 1.1;
    const wall = { isStatic: true };
    Composite.add(engine.world, [
      Bodies.rectangle(W / 2, H + 50, W * 3, 100, wall),
      Bodies.rectangle(-50, H / 2, 100, H * 10, wall),
      Bodies.rectangle(W + 50, H / 2, 100, H * 10, wall),
    ]);

    const live = [];
    const queue = [];
    for (const piece of pieces) {
      const { el } = piece;
      keep(el);
      el.dataset.revealed = 'true';   // stops motion.js from starting a reveal on a falling piece
      el.getAnimations().forEach(animation => animation.cancel());
      Object.assign(el.style, {
        position: 'fixed', left: '0', top: '0', right: 'auto', bottom: 'auto', margin: '0',
        width: piece.w + 'px', height: piece.h + 'px', minWidth: '0', maxWidth: 'none', boxSizing: 'border-box',
        animation: 'none', transition: 'none', translate: 'none', rotate: 'none', scale: 'none',
        transformOrigin: '50% 50%', willChange: 'transform', zIndex: '1000',
      });

      piece.scale = Math.min(piece.visible ? 1 : shrink, (W * 0.92) / piece.w);
      piece.body = makeBody(piece, piece.scale);
      if (piece.visible) {
        Body.setPosition(piece.body, { x: piece.cx, y: piece.cy });
      } else {
        const half = (piece.w * piece.scale) / 2;
        const x = Math.min(Math.max(piece.cx + (Math.random() - 0.5) * W * 0.3, half), W - half);
        Body.setPosition(piece.body, { x, y: -(piece.h * piece.scale) / 2 - 10 });
        el.style.visibility = 'hidden';
      }
      Body.setAngle(piece.body, piece.angle);
      Body.setAngularVelocity(piece.body, (Math.random() - 0.5) * 0.04);
      render(piece);

      if (piece.visible) {
        Composite.add(engine.world, piece.body);
        live.push(piece);
      } else {
        queue.push(piece);
      }
    }

    // Off-screen pieces enter one at a time, nearest first, once the last one has cleared the top edge.
    queue.sort((a, b) => Math.abs(a.cy - H / 2) - Math.abs(b.cy - H / 2));
    let last = null, lastAt = 0;
    Events.on(engine, 'beforeUpdate', () => {
      if (!queue.length) return;
      const now = performance.now();
      if (last && last.bounds.min.y < 0 && now - lastAt < 600) return;
      const piece = queue.shift();
      piece.el.style.visibility = '';
      Body.setVelocity(piece.body, { x: (Math.random() - 0.5) * 4, y: 8 });
      Composite.add(engine.world, piece.body);
      live.push(piece);
      last = piece.body;
      lastAt = now;
    });

    Events.on(engine, 'afterUpdate', () => {
      for (const piece of live) {
        // motion.js may still be easing the shapes' scroll drift.
        if (piece.el.style.translate !== 'none') piece.el.style.translate = piece.el.style.rotate = 'none';
        render(piece);
      }
    });

    // The pointer pushes nearby pieces away.
    const push = event => {
      for (const { body, w, h, scale } of live) {
        const dx = body.position.x - event.clientX, dy = body.position.y - event.clientY;
        const distance = Math.hypot(dx, dy), reach = 110 + (Math.max(w, h) * scale) / 2;
        if (distance > 0 && distance < reach) {
          const force = 0.0022 * body.mass * (1 - distance / reach);
          Body.applyForce(body, body.position, { x: (dx / distance) * force, y: (dy / distance) * force - force * 0.5 });
        }
      }
    };
    const onKey = event => { if (event.key === 'Escape') restore(); };
    addEventListener('pointermove', push);
    addEventListener('keydown', onKey);

    keep(root);
    Object.assign(root.style, { overflow: 'hidden', scrollbarGutter: 'stable', touchAction: 'none' });

    const runner = Runner.create();
    Runner.run(runner, engine);

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'gravity-restore';
    back.textContent = 'Put it back';
    back.addEventListener('click', restore);
    document.body.append(back);
    back.focus({ preventScroll: true });

    function restore() {
      Runner.stop(runner);
      Engine.clear(engine);
      removeEventListener('pointermove', push);
      removeEventListener('keydown', onKey);
      for (const [el, style] of saved) {
        if (style === null) el.removeAttribute('style');
        else el.setAttribute('style', style);
      }
      scrollTo({ top: scrollTop, behavior: 'instant' });
      back.remove();
      dropped = false;
      button.focus({ preventScroll: true });
    }
  }
})();
