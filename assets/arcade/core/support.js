// Capability checks shared by the arcade pages and previews.
let webgl2;

export function hasWebGL2() {
  if (webgl2 === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webgl2 = !!canvas.getContext("webgl2");
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function saveData() {
  return navigator.connection?.saveData === true;
}

// Low tier trades environment lighting and pixel density for frame rate.
export function qualityTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  const smallTouch =
    window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 400;
  const low = cores <= 4 || memory <= 4 || smallTouch;
  return { low, maxDpr: low ? 1.5 : 2 };
}
