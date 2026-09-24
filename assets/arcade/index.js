// Arcade index: saved records, then live previews once the page is idle.
// three.js loads only when a card nears the viewport.
import { hasWebGL2, reducedMotion, saveData } from "./core/support.js";
import * as storage from "./core/storage.js";

function formatTime(ms) {
  const total = Math.floor(ms / 10);
  return `${Math.floor(total / 6000)}:${String(Math.floor(total / 100) % 60).padStart(2, "0")}.${String(total % 100).padStart(2, "0")}`;
}

const best = storage.load("arcade.cube.best");
if (best?.ms) {
  const record = document.getElementById("cube-record");
  record.textContent = `Your best time: ${formatTime(best.ms)}`;
  record.hidden = false;
}
const game = storage.load("arcade.chess.game");
if (game?.pgn && game.pgn.includes("1.") && !game.resigned && Date.now() - game.updatedAt < 14 * 24 * 60 * 60 * 1000) {
  const record = document.getElementById("chess-record");
  record.innerHTML = 'You have a game in progress. <a class="text-link" href="/arcade/chess/">Resume it</a>';
  record.hidden = false;
}

// ?poster=cube or ?poster=chess pins that scene at poster size (900 × 690)
// in the corner, for capturing assets/arcade/posters/*.webp.
const posterMode = new URLSearchParams(location.search).get("poster");
if (posterMode) {
  const panel = posterMode === "chess" ? "var(--chess-panel)" : "var(--cube-panel)";
  const style = document.createElement("style");
  style.textContent = `.game-card[data-game="${posterMode}"] .game-stage-preview{position:fixed!important;left:0;top:0;z-index:100;width:900px!important;height:690px!important;aspect-ratio:auto!important;transform:none!important;background:${panel}}.game-stage-preview img{display:none}body{overflow:hidden}`;
  document.head.append(style);
}

function whenIdle(fn) {
  const run = () => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 1200));
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}

function startPreviews() {
  if (!hasWebGL2() || (!posterMode && (reducedMotion.matches || saveData()))) return;
  let previews;
  const load = () => (previews ??= import("./preview.js"));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        load().then((m) => m.mount(entry.target, { posterMode }));
      }
    },
    { rootMargin: "200px" },
  );
  document.querySelectorAll(".game-card").forEach((card) => observer.observe(card));
}

whenIdle(startPreviews);
