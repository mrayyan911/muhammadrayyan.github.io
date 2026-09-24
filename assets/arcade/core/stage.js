// One renderer, scene, and camera per canvas. Frames render on demand: only
// while a tween, drag, or animator is active, so an idle stage costs nothing.
import {
  NeutralToneMapping,
  CanvasTexture,
  HemisphereLight,
  DirectionalLight,
  PerspectiveCamera,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Tweens } from "./tween.js";

export function createStage(canvas, { fov = 30, quality, onLost, onRestored } = {}) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: window.devicePixelRatio < 2,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(fov, 1, 0.1, 100);

  if (quality.low) {
    scene.add(new HemisphereLight(0xfffaf0, 0x8a8577, 3.4));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 4);
    scene.add(sun);
  } else {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.8;
    room.dispose?.();
    pmrem.dispose();
    const key = new DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 7, 5);
    scene.add(key);
  }

  const tweens = new Tweens();
  tweens.onAdd = () => invalidate();
  const animators = new Set();
  let maxDpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
  let dpr = maxDpr;
  let frameId = 0;
  let last = 0;
  let visible = true;
  let onScreen = true;
  let lost = false;
  let disposed = false;
  let firstFrame;
  const ready = new Promise((resolve) => (firstFrame = resolve));
  // Adaptive pixel ratio: rolling frame times while the loop is active.
  const samples = [];
  let fastFrames = 0;

  const stage = {
    renderer,
    scene,
    camera,
    tweens,
    ready,
    fpsCap: 0,
    invalidate,
    animate(fn) {
      animators.add(fn);
      invalidate();
      return () => animators.delete(fn);
    },
    resize,
    dispose,
    get width() {
      return size.w;
    },
    get height() {
      return size.h;
    },
  };

  const size = { w: 1, h: 1 };

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    stage.onResize?.(w, h);
    invalidate();
  }

  function invalidate() {
    if (frameId || disposed || lost || !visible || !onScreen) return;
    frameId = requestAnimationFrame(frame);
  }

  function frame(now) {
    frameId = 0;
    // Off screen or in a hidden tab: stop; invalidate() resumes later.
    if (!visible || !onScreen || lost || disposed) {
      last = 0;
      return;
    }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    if (stage.fpsCap && last && now - last < 1000 / stage.fpsCap - 2) {
      frameId = requestAnimationFrame(frame);
      return;
    }
    const start = performance.now();
    let keepGoing = tweens.step(now);
    for (const fn of animators) {
      if (fn(now, dt)) keepGoing = true;
      else animators.delete(fn);
    }
    renderer.render(scene, camera);
    firstFrame();
    last = keepGoing ? now : 0;
    if (keepGoing) {
      adapt(performance.now() - start, now);
      frameId = requestAnimationFrame(frame);
    }
  }

  let prevNow = 0;
  function adapt(cost, now) {
    const gap = prevNow ? now - prevNow : 16;
    prevNow = now;
    samples.push(Math.max(cost, gap));
    if (samples.length < 30) return;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    samples.length = 0;
    if (avg > 22 && dpr > 1) {
      dpr = Math.max(1, dpr - 0.25);
      fastFrames = 0;
      resize();
    } else if (avg < 12 && dpr < maxDpr) {
      fastFrames += 30;
      if (fastFrames >= 120) {
        dpr = Math.min(maxDpr, dpr + 0.25);
        fastFrames = 0;
        resize();
      }
    }
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);

  const intersection = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) invalidate();
  });
  intersection.observe(canvas);

  function onVisibility() {
    visible = !document.hidden;
    if (visible) {
      last = 0;
      invalidate();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frameId);
    frameId = 0;
    onLost?.();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    onRestored?.();
    invalidate();
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    intersection.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    });
    scene.environment?.dispose();
    renderer.dispose();
  }

  resize();
  return stage;
}

// A soft radial blob, used for contact shadows instead of shadow maps.
export function blobTexture(size = 128, strength = 0.55) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(37,37,31,${strength})`);
  gradient.addColorStop(0.55, `rgba(37,37,31,${strength * 0.35})`);
  gradient.addColorStop(1, "rgba(37,37,31,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
