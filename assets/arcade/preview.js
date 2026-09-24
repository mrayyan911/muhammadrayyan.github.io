// Attract mode for the arcade cards: the real game scenes, lightly animated.
// The cube idles with a slow spin and scrambles itself on hover; the board
// replays Morphy's Opera Game (1858) on hover.
import { Chess } from "chess.js";
import { createStage } from "./core/stage.js";
import { qualityTier, reducedMotion } from "./core/support.js";
import { wait } from "./core/tween.js";
import { CubeModel, invert, scramble } from "./cube/model.js";
import { CubeView } from "./cube/view.js";
import { ChessView } from "./chess/view.js";

const OPERA_GAME =
  "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#";

function makeStage(card, fov) {
  const holder = card.querySelector(".game-stage-preview");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  holder.append(canvas);
  const quality = { ...qualityTier(), maxDpr: 1.5 };
  const stage = createStage(canvas, { fov, quality });
  stage.ready.then(() => canvas.classList.add("is-live"));
  return { stage, quality, link: card.querySelector(".game-visual") };
}

// Hover and keyboard focus both start the attract loop.
function onEngage(link, start, stop) {
  link.addEventListener("pointerenter", start);
  link.addEventListener("focus", start);
  link.addEventListener("pointerleave", stop);
  link.addEventListener("blur", stop);
}

function mountCube(card, { posterMode }) {
  const { stage, quality, link } = makeStage(card, 30);
  stage.camera.position.set(0, 1.5, 11.5);
  stage.camera.lookAt(0, -0.3, 0);
  const view = new CubeView(stage, new CubeModel(), { quality, reducedMotion });
  let engaged = false;
  let running = false;
  let applied = [];

  if (!posterMode) {
    stage.fpsCap = 30;
    stage.animate((now, dt) => {
      if (engaged) {
        stage.fpsCap = 0;
        return true;
      }
      stage.fpsCap = 30;
      view.root.rotation.y += dt * ((8 * Math.PI) / 180);
      stage.invalidate();
      return true;
    });
  }

  async function loop() {
    if (running) return;
    running = true;
    while (engaged) {
      for (const move of scramble(6)) {
        if (!engaged) break;
        await view.enqueue(move, { duration: 160 });
        applied.push(move);
      }
      if (!engaged) break;
      await wait(600);
      const back = invert(applied);
      applied = [];
      for (const move of back) await view.enqueue(move, { duration: 160 });
      await wait(400);
    }
    // Settle back to solved.
    const back = invert(applied);
    applied = [];
    for (const move of back) await view.enqueue(move, { duration: 90 });
    running = false;
  }
  onEngage(
    link,
    () => {
      engaged = true;
      loop();
    },
    () => (engaged = false),
  );
}

function mountChess(card) {
  const { stage, quality, link } = makeStage(card, 35);
  const view = new ChessView(stage, { quality, reducedMotion, interactive: false, compact: true });
  let game = new Chess();
  view.setPosition(game.board());
  view.placeCamera(false);
  stage.onResize = () => view.placeCamera(false);
  document.fonts.ready.then(() => view.refreshCoordinates());

  const moves = new Chess();
  moves.loadPgn(OPERA_GAME);
  const line = moves.history();
  let engaged = false;
  let running = false;

  function reset() {
    game = new Chess();
    view.setPosition(game.board());
    view.setHighlights({ lastMove: [], check: null });
  }

  async function loop() {
    if (running) return;
    running = true;
    while (engaged) {
      const slots = { w: 0, b: 0 };
      for (const san of line) {
        if (!engaged) break;
        const move = game.move(san);
        view.setHighlights({ lastMove: [move.from, move.to], check: null });
        await view.animateMove(move, move.captured ? slots[move.color]++ : 0);
        if (game.inCheck()) view.setHighlights({ check: kingSquare(game) });
        await wait(700);
      }
      if (engaged) await wait(1500);
      reset();
      if (engaged) await wait(500);
    }
    running = false;
  }
  onEngage(
    link,
    () => {
      engaged = true;
      loop();
    },
    () => (engaged = false),
  );
}

function kingSquare(game) {
  for (const row of game.board()) for (const cell of row) if (cell?.type === "k" && cell.color === game.turn()) return cell.square;
  return null;
}

export function mount(card, options = {}) {
  if (card.dataset.game === "cube") mountCube(card, options);
  else if (card.dataset.game === "chess") mountChess(card, options);
}
