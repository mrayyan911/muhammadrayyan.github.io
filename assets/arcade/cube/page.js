import { createStage } from "../core/stage.js";
import { hasWebGL2, qualityTier, reducedMotion } from "../core/support.js";
import * as storage from "../core/storage.js";
import { click } from "../core/sound.js";
import { CubeModel, format, scramble as randomScramble } from "./model.js";
import { CubeView } from "./view.js";
import { CubeInput } from "./input.js";

const STATE_KEY = "arcade.cube.state";
const BEST_KEY = "arcade.cube.best";
const PREFS_KEY = "arcade.cube.prefs";

const $ = (id) => document.getElementById(id);
const stageEl = $("stage");
const canvas = stageEl.querySelector("canvas");
const statusEl = $("cube-status");
const timeEl = $("time");
const movesEl = $("moves");
const bestEl = $("best");
const buttons = { scramble: $("scramble"), undo: $("undo"), reset: $("reset") };

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 10));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function showMessage(html) {
  const box = $("stage-message");
  box.innerHTML = html;
  box.hidden = false;
}

function start() {
  if (!hasWebGL2()) {
    statusEl.textContent = "This game can’t run in this browser.";
    showMessage(
      '<p>This game needs WebGL, which your browser has turned off or doesn’t support. Try another browser, or go back to the arcade.</p><div class="button-row"><a class="text-link" href="/arcade/">All games</a></div>',
    );
    return;
  }

  const quality = qualityTier();
  const stage = createStage(canvas, {
    fov: 30,
    quality,
    onLost: () => {
      stageEl.classList.remove("is-live");
      showMessage('<p>The 3D view stopped.</p><div class="button-row"><button type="button" class="button button-small" onclick="location.reload()">Reload the game</button></div>');
    },
  });
  const camera = stage.camera;
  stage.onResize = (w, h) => {
    const aspect = w / h;
    const distance = aspect < 1 ? 10.8 / Math.max(aspect, 0.55) : 10.8;
    camera.position.set(0, 1.5 * (distance / 10.8), distance);
    camera.lookAt(0, -0.3, 0);
  };
  stage.onResize(stage.width, stage.height);

  const model = new CubeModel();
  const view = new CubeView(stage, model, { quality, reducedMotion });

  let state = "free"; // free | scrambling | ready | solving | solved
  let history = [];
  let moveCount = 0;
  let startedAt = 0;
  let elapsed = 0;
  let scrambleText = "";
  let timerFrame = 0;
  const prefs = storage.load(PREFS_KEY, { letters: false, sound: false });
  let best = storage.load(BEST_KEY);

  const input = new CubeInput(canvas, stage, view, {
    canTurn: () => state !== "scrambling",
    onTurn: (move) => afterUserMove({ ...move, name: view.nameFromMove(move) }),
  });

  // Restore a saved solve or free-play position.
  const saved = storage.load(STATE_KEY);
  if (saved && model.restore(saved.cubies)) {
    view.sync();
    state = saved.state === "solving" || saved.state === "ready" || saved.state === "solved" ? saved.state : "free";
    history = saved.history ?? [];
    moveCount = saved.moves ?? 0;
    scrambleText = saved.scramble ?? "";
    startedAt = saved.startedAt ?? 0;
    elapsed = saved.elapsed ?? 0;
    if (state === "solving") startTimer(startedAt);
  }

  function persist() {
    if (state === "scrambling") return;
    storage.save(STATE_KEY, {
      cubies: model.serialize(),
      state,
      history: history.slice(-500),
      moves: moveCount,
      scramble: scrambleText,
      startedAt,
      elapsed,
    });
  }

  function startTimer(from = Date.now()) {
    startedAt = from;
    cancelAnimationFrame(timerFrame);
    const tick = () => {
      elapsed = Date.now() - startedAt;
      timeEl.textContent = formatTime(elapsed);
      timerFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopTimer() {
    cancelAnimationFrame(timerFrame);
    if (state === "solving") elapsed = Date.now() - startedAt;
  }

  function render() {
    timeEl.textContent = formatTime(elapsed);
    timeEl.classList.toggle("is-highlight", state === "solved");
    movesEl.textContent = String(moveCount);
    bestEl.textContent = best ? formatTime(best.ms) : "—";
    buttons.scramble.disabled = state === "scrambling";
    buttons.undo.disabled = state === "scrambling" || state === "ready" || history.length === 0;
    buttons.reset.disabled = state === "scrambling" || (model.isSolved() && state === "free" && moveCount === 0);
    $("scramble-block").hidden = !scrambleText;
    $("scramble-text").textContent = scrambleText;
    document.querySelectorAll("#move-pad button").forEach((b) => (b.disabled = state === "scrambling"));
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function idleStatus() {
    if (state === "free") return model.isSolved() ? "Press Scramble to start." : "Free play. Press Scramble for a timed solve.";
    if (state === "ready") return "The timer starts on your first turn.";
    if (state === "solving") return "Solving…";
    return statusEl.textContent;
  }

  function afterUserMove(move) {
    if (prefs.sound) click();
    history.push({ axis: move.axis, layers: move.layers, k: move.k, name: move.name });
    moveCount += 1;
    if (state === "ready") {
      state = "solving";
      startTimer();
      setStatus("Solving…");
    } else if (state === "solved") {
      state = "free";
      scrambleText = "";
    }
    if (state === "solving" && model.isSolved()) {
      stopTimer();
      state = "solved";
      const isBest = !best || elapsed < best.ms;
      if (isBest) {
        best = { ms: elapsed, moves: moveCount, date: new Date().toISOString().slice(0, 10) };
        storage.save(BEST_KEY, best);
      }
      setStatus(`Solved in ${formatTime(elapsed)} with ${moveCount} moves.${isBest ? " New best time." : ""}`);
      view.celebrate();
    } else if (state !== "solved") {
      setStatus(idleStatus());
    }
    render();
    persist();
  }

  function playMove(move) {
    if (state === "scrambling" || input.drag) return;
    view.enqueue(move).then(() => afterUserMove(move));
  }

  async function doScramble() {
    if (state === "scrambling") return;
    input.cancelDrag();
    view.cancelQueue();
    stopTimer();
    state = "scrambling";
    setStatus("Scrambling…");
    if (!model.isSolved()) {
      model.reset();
      view.sync();
    }
    history = [];
    moveCount = 0;
    elapsed = 0;
    const tokens = format(randomScramble(25)).split(" ");
    scrambleText = tokens.join(" ");
    const moves = tokens.map((t) => view.moveFromNotation(t));
    render();
    if (reducedMotion.matches) {
      view.applyInstant(moves);
    } else {
      await Promise.all(moves.map((m) => view.enqueue(m, { duration: 65 })));
    }
    state = "ready";
    setStatus(idleStatus());
    render();
    persist();
  }

  function doReset(confirmed = false) {
    if (state === "solving" && !confirmed) {
      $("reset-confirm").hidden = false;
      $("reset-no").focus();
      return;
    }
    $("reset-confirm").hidden = true;
    input.cancelDrag();
    view.cancelQueue();
    stopTimer();
    model.reset();
    view.sync();
    state = "free";
    history = [];
    moveCount = 0;
    elapsed = 0;
    scrambleText = "";
    setStatus(idleStatus());
    render();
    persist();
    buttons.scramble.focus();
  }

  function doUndo() {
    if (buttons.undo.disabled || view.busy) return;
    const last = history.pop();
    if (!last) return;
    const inverse = view.inverse(last);
    view.enqueue(inverse).then(() => {
      // Undo counts as a move, but isn't itself undoable.
      afterUserMove(inverse);
      history.pop();
      render();
      persist();
    });
  }

  buttons.scramble.addEventListener("click", doScramble);
  buttons.undo.addEventListener("click", doUndo);
  buttons.reset.addEventListener("click", () => doReset());
  $("reset-yes").addEventListener("click", () => doReset(true));
  $("reset-no").addEventListener("click", () => {
    $("reset-confirm").hidden = true;
    buttons.reset.focus();
  });

  // On-screen move pad for keyboard, switch, and screen-reader users.
  const faceNames = { U: "top", D: "bottom", L: "left", R: "right", F: "front", B: "back" };
  const pad = $("move-pad");
  for (const face of "UDLRFB") {
    for (const [suffix, label] of [["", "clockwise"], ["'", "counterclockwise"], ["2", "twice"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = face + (suffix === "'" ? "′" : suffix);
      button.setAttribute("aria-label", `Turn the ${faceNames[face]} layer ${label}`);
      button.addEventListener("click", () => playMove(view.moveFromNotation(face + suffix)));
      pad.append(button);
    }
  }

  const letters = $("letters");
  const sound = $("sound");
  letters.checked = prefs.letters;
  sound.checked = prefs.sound;
  const applyLetters = () => document.fonts.ready.then(() => view.setLetters(letters.checked));
  if (prefs.letters) applyLetters();
  letters.addEventListener("change", () => {
    prefs.letters = letters.checked;
    storage.save(PREFS_KEY, prefs);
    applyLetters();
  });
  sound.addEventListener("change", () => {
    prefs.sound = sound.checked;
    storage.save(PREFS_KEY, prefs);
    if (sound.checked) click();
  });

  document.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target.closest?.("input, textarea, select, [contenteditable]")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      doUndo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      if (input.cancelDrag()) e.preventDefault();
      return;
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && (target === canvas || target === document.body)) {
      e.preventDefault();
      const [dx, dy] = arrows[e.key];
      input.rotateBy((dx * Math.PI) / 12 / 0.008, (dy * Math.PI) / 12 / 0.008);
      return;
    }
    if (e.key === "Home" && (target === canvas || target === document.body)) {
      e.preventDefault();
      input.resetView();
      return;
    }
    if (target.closest?.("button, a, summary") && (e.key === " " || e.key === "Enter")) return;
    const letter = e.key.length === 1 ? e.key.toUpperCase() : "";
    if (!"UDLRFBMESXYZ".includes(letter) || !letter) return;
    if (view.queue.length >= 4) return;
    e.preventDefault();
    const token = ("XYZ".includes(letter) ? letter.toLowerCase() : letter) + (e.shiftKey ? "'" : "");
    playMove(view.moveFromNotation(token));
  });

  window.addEventListener("pagehide", (event) => {
    persist();
    if (!event.persisted) stage.dispose();
  });

  setStatus(state === "solved" ? `Solved in ${formatTime(elapsed)} with ${moveCount} moves.` : idleStatus());
  render();
  stage.ready.then(() => stageEl.classList.add("is-live"));
  stage.invalidate();
}

start();
