(() => {
  const root = document.querySelector('.hoops');
  const M = window.Matter;
  if (!root || !M) return;
  const { Engine, Bodies, Body, Composite } = M;
  const $ = (s) => root.querySelector(s);
  const cv = $('canvas'), ctx = cv.getContext('2d');
  const svg = $('.hoops-badge svg'), ballEl = $('.hoops-ball');
  const countEl = $('.hoops-count'), statusEl = $('.hoops-status');
  const titleEl = $('#nf-title'), againEl = $('.hoops-again');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const SHOTS = 5, NEED = 3, STEP = 1000 / 120, K = 10, DOTS = 20;
  const ORANGE = '#e8571f', COLORS = ['#12141a', '#25695a', ORANGE];
  // Hoop art lives in a 200-unit viewBox; the physics reads the same numbers.
  const VB = { cx: 100, rimY: 108, rx: 70, bx0: 28, bx1: 172, by0: 22 };

  let W = 0, H = 0, dpr = 1, r = 20, D = 1, G = 1, Lmax = 1, floorY = 0;
  let rim = { cx: 0, y: 0, L: 0, R: 0, ry: 0, w: 0, sw: 0 };
  let minD = 0, engine, ball, rr = 4, sprite = null;
  let state = 'idle'; // idle | flying | over
  const rest = { x: 0, y: 0 }, pull = { x: 0, y: 0 };
  let aiming = false, dragId = null;
  let made = 0, left = SHOTS, scored = false, up = false, lastX = 0, lastY = 0;
  let shotT = 0, slowT = 0, touchedFloor = false, endAt = 0;
  let netAmp = 0, netT = 0, raf = 0, lastTs = 0, acc = 0;
  const P = new Float32Array(14 * 7); // x y vx vy rot vr life
  let pAlive = 0;

  const pad2 = (n) => String(n).padStart(2, '0');
  const say = (t) => { statusEl.textContent = t; };
  const setCount = () => { countEl.textContent = `${pad2(left)} SHOTS LEFT`; };

  function buildSprite() {
    const s = Math.ceil(r * 2 * dpr) + 4;
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = s;
    const c = sprite.getContext('2d'), m = s / 2, R = r * dpr;
    const g = c.createRadialGradient(m - R * 0.35, m - R * 0.4, R * 0.1, m, m, R);
    g.addColorStop(0, '#ef8a4c'); g.addColorStop(1, '#d9682b');
    c.fillStyle = g; c.beginPath(); c.arc(m, m, R, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(m, m, R, 0, 7); c.clip();
    c.strokeStyle = '#12141a'; c.lineWidth = Math.max(1.2, R * 0.07); c.lineCap = 'round';
    c.beginPath(); c.moveTo(m - R, m); c.lineTo(m + R, m); c.moveTo(m, m - R); c.lineTo(m, m + R); c.stroke();
    c.beginPath(); c.arc(m - R * 1.12, m, R * 0.82, -1, 1); c.stroke();
    c.beginPath(); c.arc(m + R * 1.12, m, R * 0.82, Math.PI - 1, Math.PI + 1); c.stroke();
    c.restore();
  }

  function layout() {
    const zr = root.getBoundingClientRect();
    W = zr.width; H = zr.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const sr = svg.getBoundingClientRect(), sc = sr.width / 200;
    const ox = sr.left - zr.left, oy = sr.top - zr.top;
    rim = { cx: ox + VB.cx * sc, y: oy + VB.rimY * sc, ry: 10 * sc, w: VB.rx * 2 * sc, sw: 5 * sc };
    rim.L = rim.cx - VB.rx * sc; rim.R = rim.cx + VB.rx * sc;
    r = Math.min(44, Math.max(18, rim.w * 0.27));
    rr = Math.max(3, r * 0.17);
    floorY = $('.hoops-bar').getBoundingClientRect().top - zr.top - 16;
    D = floorY - r - rim.y; G = 3 * D; Lmax = 0.34 * D;
    buildSprite();

    engine = Engine.create();
    engine.gravity.scale = G / 1e6;
    const o = { isStatic: true, restitution: 0.5, friction: 0.2 };
    const rimO = { ...o, collisionFilter: { category: 4 } };
    const bw = (VB.bx1 - VB.bx0) * sc, bTop = oy + VB.by0 * sc;
    minD = (bw / 2 + r) / 0.6 + 8;
    const bH = Math.max(8, rim.y - 2.2 * r - bTop);
    ball = Bodies.circle(0, 0, r, { restitution: 0.55, friction: 0.08, frictionAir: 0 });
    Composite.add(engine.world, [
      Bodies.circle(rim.L, rim.y, rr, rimO), Bodies.circle(rim.R, rim.y, rr, rimO),
      Bodies.rectangle(rim.cx, bTop + bH / 2, bw, bH, { ...o, collisionFilter: { category: 2 } }),
      Bodies.rectangle(W / 2, floorY + 40, W * 3, 80, o),
      Bodies.rectangle(-40, H / 2, 80, H * 4, o), Bodies.rectangle(W + 40, H / 2, 80, H * 4, o),
      ball,
    ]);
    const hit = Math.max(r + 14, 30);
    ballEl.style.width = ballEl.style.height = hit * 2 + 'px';
    ballEl.dataset.hit = hit;
    respawn();
  }

  function respawn() {
    state = 'idle'; scored = up = touchedFloor = aiming = false; pull.x = pull.y = 0;
    const span = Math.min(W * 0.4, 420);
    // Keep the rising leg clear of the hoop so a fair shot never has to climb through it.
    let tries = 0;
    do rest.x = W / 2 + (Math.random() * 2 - 1) * span; while (Math.abs(rest.x - rim.cx) < minD && ++tries < 20);
    rest.y = floorY - r;
    Body.setPosition(ball, { x: rest.x, y: rest.y }); Body.setAngle(ball, 0);
    Body.setVelocity(ball, { x: 0, y: 0 }); Body.setAngularVelocity(ball, 0); ball.frictionAir = 0;
    const hit = +ballEl.dataset.hit;
    ballEl.style.transform = `translate(${rest.x - hit}px,${rest.y - hit}px)`;
    ballEl.style.visibility = '';
    render();
  }

  function setPull(x, y) {
    const l = Math.hypot(x, y), k = l > Lmax ? Lmax / l : 1;
    pull.x = x * k; pull.y = y * k;
    render();
  }

  // Keyboard default aims straight at the rim so Enter alone is a fair shot.
  function assistPull() {
    const vy = Math.sqrt(2 * G * D * 1.45), t = (vy + Math.sqrt(vy * vy - 2 * G * D)) / G;
    setPull(-((rim.cx - rest.x) / t) / K, vy / K);
  }

  function launch() {
    if (Math.hypot(pull.x, pull.y) < 12) { pull.x = pull.y = 0; aiming = false; render(); return; }
    Body.setVelocity(ball, { x: (-pull.x * K) / 60, y: (-pull.y * K) / 60 });
    state = 'flying'; shotT = slowT = acc = endAt = 0; lastX = ball.position.x; lastY = ball.position.y;
    pull.x = pull.y = 0; aiming = false;
    ballEl.style.visibility = 'hidden';
    say('');
    kick();
  }

  function confetti() {
    for (let i = 0; i < 14; i++) {
      const o = i * 7, a = -Math.PI * (0.15 + Math.random() * 0.7), s = (0.5 + Math.random()) * D * 0.9;
      P[o] = rim.cx; P[o + 1] = rim.y; P[o + 2] = Math.cos(a) * s; P[o + 3] = Math.sin(a) * s;
      P[o + 4] = Math.random() * 6; P[o + 5] = (Math.random() - 0.5) * 16; P[o + 6] = 0.5 + Math.random() * 0.2;
    }
    pAlive = 14;
  }

  function endShot() {
    left--; setCount();
    if (scored) made++;
    const won = made >= NEED, over = won || left === 0;
    const more = `Make ${NEED - made} more to win, ${left} ${left === 1 ? 'shot' : 'shots'} left.`;
    say(scored
      ? `Swish! That's ${made} of ${SHOTS}. ${won ? 'You win.' : more}`
      : `Missed. ${made} of ${SHOTS} so far. ${over ? '' : more}`);
    if (over) {
      state = 'over';
      titleEl.textContent = won ? 'Nothing here, but nice shooting.' : 'Airball. Try again?';
      againEl.hidden = false;
      ballEl.style.visibility = 'hidden';
      render();
    } else respawn();
  }

  function step() {
    // Rising balls bank off the board but pass the rim; falling balls pass the board but hit the rim.
    ball.collisionFilter.mask = ball.velocity.y < 0 ? 0xffff & ~4 : 0xffff & ~2;
    Engine.update(engine, STEP);
    const { x, y } = ball.position;
    const crossX = () => lastX + (x - lastX) * ((rim.y - lastY) / (y - lastY));
    if (lastY < rim.y && y >= rim.y) {
      const px = crossX();
      if (px > rim.L + rr && px < rim.R - rr) {
        netAmp = 1; netT = 0;
        if (!up && !scored) { scored = true; endAt = shotT + 0.9; if (!reduced.matches) confetti(); }
      }
    } else if (lastY >= rim.y && y < rim.y) {
      const px = crossX();
      if (px > rim.L && px < rim.R) up = true; // a ball that rose through the rim cannot score
    }
    lastX = x; lastY = y;
    if (y > floorY - r - 2) { touchedFloor = true; ball.frictionAir = 0.05; }
    slowT = Math.hypot(ball.velocity.x, ball.velocity.y) * 60 < 25 ? slowT + STEP / 1000 : 0;
    shotT += STEP / 1000;
    if (slowT > 0.5 || shotT > 8 || y > H + 300 || (endAt && shotT > endAt)) endShot();
  }

  const need = () => state === 'flying' || netAmp > 0 || pAlive > 0;

  function frame(ts) {
    raf = 0;
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
    lastTs = ts;
    if (state === 'flying') {
      acc += dt * 1000;
      while (acc >= STEP && state === 'flying') { step(); acc -= STEP; }
    }
    if (netAmp > 0.01) { netT += dt; netAmp *= Math.exp(-4 * dt); } else netAmp = 0;
    if (pAlive) {
      pAlive = 0;
      for (let o = 0; o < P.length; o += 7) {
        if (P[o + 6] <= 0) continue;
        P[o + 6] -= dt; P[o + 3] += G * 0.6 * dt;
        P[o] += P[o + 2] * dt; P[o + 1] += P[o + 3] * dt; P[o + 4] += P[o + 5] * dt;
        if (P[o + 6] > 0) pAlive++;
      }
    }
    render();
    if (need() && !document.hidden) raf = requestAnimationFrame(frame); else lastTs = 0;
  }

  function kick() {
    if (!raf && !document.hidden && need()) raf = requestAnimationFrame(frame);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const flying = state === 'flying', showBall = state !== 'over';
    const bx = flying ? ball.position.x : rest.x + pull.x * 0.15;
    const by = flying ? ball.position.y : rest.y + pull.y * 0.15;
    if (showBall) {
      const h = Math.max(0, Math.min(1, (floorY - by - r) / D));
      ctx.fillStyle = `rgba(18,20,26,${0.2 - h * 0.12})`;
      ctx.beginPath(); ctx.ellipse(bx, floorY + 2, r * (1 - h * 0.4), r * 0.22 * (1 - h * 0.4), 0, 0, 7); ctx.fill();
    }
    if (!flying && showBall && (pull.x || pull.y)) {
      const vx = -pull.x * K, vy = -pull.y * K;
      ctx.fillStyle = ORANGE;
      for (let i = 1; i <= DOTS; i++) {
        const t = i * 0.05, y = rest.y + vy * t + 0.5 * G * t * t;
        if (y > floorY) break;
        ctx.globalAlpha = 1 - i / (DOTS + 3);
        ctx.beginPath(); ctx.arc(rest.x + vx * t, y, Math.max(2, r * 0.15), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (showBall) {
      ctx.save(); ctx.translate(bx, by); ctx.rotate(flying ? ball.angle : 0);
      ctx.drawImage(sprite, -sprite.width / 2 / dpr, -sprite.height / 2 / dpr, sprite.width / dpr, sprite.height / dpr);
      ctx.restore();
    }
    drawNet();
    if (pAlive) {
      for (let o = 0; o < P.length; o += 7) {
        if (P[o + 6] <= 0) continue;
        ctx.fillStyle = COLORS[(o / 7) % 3]; ctx.globalAlpha = Math.min(1, P[o + 6] * 4);
        ctx.save(); ctx.translate(P[o], P[o + 1]); ctx.rotate(P[o + 4]);
        const s = Math.max(3, r * 0.28); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawNet() {
    const rm = reduced.matches;
    const sway = rm ? 0 : netAmp * Math.sin(netT * 28) * rim.w * 0.2;
    const depth = rim.w * 0.5 * (1 + (rm ? 0 : netAmp * 0.25));
    const tw = rim.w * 0.55, bot = rim.y + depth;
    ctx.lineWidth = Math.max(1, rim.w * 0.02); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const t0 = rim.L + (i * rim.w) / 4, t1 = t0 + rim.w / 4;
      const b0 = rim.cx - tw / 2 + (i * tw) / 4 + sway, b1 = b0 + tw / 4;
      ctx.moveTo(t0, rim.y); ctx.lineTo(b1, bot);
      ctx.moveTo(t1, rim.y); ctx.lineTo(b0, bot);
    }
    ctx.moveTo(rim.cx - tw / 2 + sway, bot); ctx.lineTo(rim.cx + tw / 2 + sway, bot);
    const mw = (rim.w + tw) / 4;
    ctx.moveTo(rim.cx - mw + sway / 2, rim.y + depth / 2); ctx.lineTo(rim.cx + mw + sway / 2, rim.y + depth / 2);
    ctx.stroke();
    ctx.strokeStyle = ORANGE; ctx.lineWidth = rim.sw;
    ctx.beginPath(); ctx.ellipse(rim.cx, rim.y, rim.w / 2, rim.ry, 0, 0, Math.PI); ctx.stroke();
  }

  function reset() {
    made = 0; left = SHOTS; setCount(); againEl.hidden = true;
    titleEl.textContent = 'Oops! Airball.'; say('');
    pAlive = 0; netAmp = 0; respawn();
  }

  ballEl.addEventListener('pointerdown', (e) => {
    if (state !== 'idle' || dragId !== null) return;
    dragId = e.pointerId; ballEl.setPointerCapture(dragId); e.preventDefault();
  });
  ballEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    const zr = root.getBoundingClientRect();
    aiming = true; setPull(e.clientX - zr.left - rest.x, e.clientY - zr.top - rest.y);
  });
  const release = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    if (e.type === 'pointerup') launch(); else { pull.x = pull.y = 0; render(); }
  };
  ballEl.addEventListener('pointerup', release);
  ballEl.addEventListener('pointercancel', release);

  root.addEventListener('keydown', (e) => {
    if (e.target !== root || state !== 'idle') return;
    if (e.key === 'Enter') { e.preventDefault(); launch(); return; }
    const d = { ArrowDown: [0, 4], ArrowUp: [0, -4], ArrowLeft: [1, 0], ArrowRight: [-1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    if (!aiming) { aiming = true; assistPull(); }
    const s = e.shiftKey ? 5 : 1;
    setPull(pull.x + d[0] * s, pull.y + d[1] * s);
  });

  againEl.addEventListener('click', () => { reset(); root.focus({ preventScroll: true }); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf); raf = 0; lastTs = 0; // a hidden tab can drop its pending frame, so never trust a stale handle
    kick();
  });

  let rt = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(rt);
    rt = requestAnimationFrame(() => {
      const over = state === 'over';
      layout();
      if (over) { state = 'over'; ballEl.style.visibility = 'hidden'; render(); }
    });
  }).observe(root);

  setCount();
  document.fonts.ready.then(layout);
})();
