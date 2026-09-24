// A tiny tween manager. The stage calls step() each active frame; tweens keep
// the frame loop alive until they finish.
export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
};

export class Tweens {
  constructor() {
    this.list = [];
  }

  // Resolves when the tween completes (or immediately for duration 0).
  add({ duration, easing = ease.outCubic, update, delay = 0 }) {
    return new Promise((resolve) => {
      if (duration <= 0 && delay <= 0) {
        update(1);
        resolve();
        return;
      }
      this.list.push({ start: performance.now() + delay, duration, easing, update, resolve });
      this.onAdd?.();
    });
  }

  get active() {
    return this.list.length > 0;
  }

  step(now) {
    const done = [];
    this.list = this.list.filter((t) => {
      if (now < t.start) return true;
      const p = t.duration <= 0 ? 1 : Math.min(1, (now - t.start) / t.duration);
      t.update(t.easing(p));
      if (p >= 1) {
        done.push(t.resolve);
        return false;
      }
      return true;
    });
    done.forEach((resolve) => resolve());
    return this.list.length > 0;
  }

  clear() {
    this.list = [];
  }
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
