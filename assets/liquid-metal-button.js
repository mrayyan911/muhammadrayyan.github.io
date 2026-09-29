// Liquid metal rim for `.liquid-button`. The button's face is plain CSS; this draws
// only the chrome rim (a signed-distance ring shaded like a polished tube) on a canvas.
// Falls back to the CSS conic-gradient rim without WebGL. Honors reduced motion and the
// site's `motion-paused` body class, and only renders while visible.
(() => {
  const buttons = document.querySelectorAll('.liquid-button, .glass-nav');
  if (!buttons.length) return;

  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
precision highp float;
uniform vec2 res, mouse;
uniform float time, hover, press, rim, radius;
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float pool(float a, float b, float s){ return exp((cos(a - b) - 1.) * s); }
float sd(vec2 p){ vec2 h = res * .5; return sdBox(p, h, min(radius, h.y)); }
float studio(vec3 r, float a, float q, float shift){
  float f = sin(a * 2. - time * .6) + .3 * sin(a * 3. + time * .35) + q * .55 + r.z * .15 + shift;
  float band = smoothstep(-.5, -.25, f) - smoothstep(.35, .6, f);
  float strip = smoothstep(.82, .95, f);
  return .1 + .75 * band + .7 * strip + .1 * (.5 + .5 * r.z);
}
void main(){
  vec2 p = gl_FragCoord.xy - res * .5;
  p.y = -p.y;
  float d = sd(p);
  float w = rim * (1. + hover * .35 + press * .3);
  float px = 1.;
  float cov = smoothstep(px, -px, d) * smoothstep(-w - px, -w + px, d);
  vec2 e = vec2(.75, 0.);
  vec2 g = normalize(vec2(sd(p + e.xy) - sd(p - e.xy), sd(p + e.yx) - sd(p - e.yx)) + 1e-5);
  float q = clamp((d + w * .5) / (w * .5), -1., 1.);
  float z = sqrt(max(1. - q * q, .0001));
  vec3 n = normalize(vec3(g * q, z));
  vec3 rf = reflect(vec3(0., 0., -1.), n);
  float a = atan(p.y / res.y, p.x / res.x);
  float pa = atan((mouse.y - res.y * .5) / res.y, (mouse.x - res.x * .5) / res.x);
  float near = hover * pool(a, pa, 2.5);
  float sh = .12 + .1 * pool(a, time * .5, 2.);
  vec3 c = vec3(studio(rf, a, q, sh), studio(rf, a, q, 0.), studio(rf, a, q, -sh));
  float hot = pool(a, time * .5 - 1.7, 12.) + .7 * pool(a, -time * .35 + 1.2, 20.);
  c += vec3(.75, .87, 1.) * hot * z * z * .7;
  c = mix(c, vec3(1.), near * pow(z, 3.) * .55);
  c = mix(c, vec3(.95, .98, 1.), pow(abs(q), 12.) * .35);
  gl_FragColor = vec4(clamp(c, 0., 1.) * cov, cov);
}`;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isPaused = () => reduced.matches || document.body.classList.contains('motion-paused');

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  function setup(button) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n);
    const U = { res: u('res'), mouse: u('mouse'), time: u('time'), hover: u('hover'), press: u('press'), rim: u('rim'), radius: u('radius') };
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    button.prepend(canvas);
    button.dataset.webgl = '';

    const rimPx = () => parseFloat(getComputedStyle(button).getPropertyValue('--lm-rim')) || 3;
    const state = { hover: 0, hoverT: 0, press: 0, pressT: 0, mx: 0, my: 0, visible: true, raf: 0, w: 0, h: 0 };
    let last = performance.now();
    let t = Math.random() * 20;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      state.w = button.clientWidth;
      state.h = button.clientHeight;
      canvas.width = Math.round(state.w * dpr);
      canvas.height = Math.round(state.h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      state.dpr = dpr;
      if (!state.mx) { state.mx = state.w * .5; state.my = state.h * .5; }
    }

    function draw(now) {
      const dt = Math.min((now - last) / 1000, .05);
      last = now;
      if (!isPaused()) t += dt;
      const k = 1 - Math.exp(-dt * 9);
      state.hover += (state.hoverT - state.hover) * k;
      state.press += (state.pressT - state.press) * k;
      const dpr = state.dpr;
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.mouse, state.mx * dpr, state.my * dpr);
      gl.uniform1f(U.time, t);
      gl.uniform1f(U.hover, state.hover);
      gl.uniform1f(U.press, state.press);
      gl.uniform1f(U.rim, rimPx() * dpr * 1.15);
      gl.uniform1f(U.radius, (parseFloat(getComputedStyle(button).borderTopLeftRadius) || 1e4) * dpr);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now) {
      draw(now);
      const settled = Math.abs(state.hover - state.hoverT) < .002 && Math.abs(state.press - state.pressT) < .002;
      state.raf = state.visible && !document.hidden && !(isPaused() && settled) ? requestAnimationFrame(loop) : 0;
    }
    const wake = () => { if (!state.raf) { last = performance.now(); state.raf = requestAnimationFrame(loop); } };

    button.addEventListener('pointermove', e => {
      const r = button.getBoundingClientRect();
      state.mx = e.clientX - r.left;
      state.my = e.clientY - r.top;
      wake();
    });
    button.addEventListener('pointerenter', () => { state.hoverT = 1; wake(); });
    button.addEventListener('pointerleave', () => { state.hoverT = 0; state.pressT = 0; wake(); });
    button.addEventListener('pointerdown', () => { state.pressT = 1; wake(); });
    button.addEventListener('pointerup', () => { state.pressT = 0; wake(); });
    button.addEventListener('focus', () => { state.hoverT = 1; wake(); });
    button.addEventListener('blur', () => { state.hoverT = 0; wake(); });

    new ResizeObserver(() => { resize(); wake(); }).observe(button);
    new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; if (state.visible) wake(); }).observe(button);
    document.addEventListener('visibilitychange', wake);
    reduced.addEventListener('change', wake);
    new MutationObserver(wake).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    resize();
    wake();
  }

  buttons.forEach(setup);
})();
