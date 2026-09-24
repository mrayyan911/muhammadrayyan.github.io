// Two brief blinks on arrival. The static PNG also works without JavaScript.
(() => {
  const icon = document.querySelector("#favicon");
  if (!icon) return;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const still = icon.href;
  const blinkUrl = new URL("favicon-avatar-blink.png", still);
  blinkUrl.search = new URL(still).search;
  const blink = blinkUrl.href;
  const frame = new Image();
  let timers = [];
  let ready = false;

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    icon.href = still;
  }

  function play() {
    stop();
    if (!ready || motion.matches || document.hidden) return;
    timers = [[1200, blink], [1340, still], [3400, blink], [3540, still]]
      .map(([delay, href]) => setTimeout(() => { icon.href = href; }, delay));
  }

  frame.onload = () => { ready = true; play(); };
  frame.src = blink;
  motion.addEventListener("change", play);
  document.addEventListener("visibilitychange", play);
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", play);
})();
