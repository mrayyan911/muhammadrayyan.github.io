import { Chess } from "chess.js";
import { createStage } from "../core/stage.js";
import { hasWebGL2, qualityTier, reducedMotion } from "../core/support.js";
import * as storage from "../core/storage.js";
import { click } from "../core/sound.js";
import { wait } from "../core/tween.js";
import { ChessView } from "./view.js";
import { ChessInput } from "./input.js";

const GAME_KEY = "arcade.chess.game";
const PREFS_KEY = "arcade.chess.prefs";
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const GLYPHS = { w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" }, b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" } };
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

const $ = (id) => document.getElementById(id);
const stageEl = $("stage");
const canvas = stageEl.querySelector("canvas");
const statusEl = $("chess-status");

function start() {
  if (!hasWebGL2()) {
    statusEl.textContent = "This game can’t run in this browser.";
    const box = $("stage-message");
    box.innerHTML =
      '<p>This game needs WebGL, which your browser has turned off or doesn’t support. Try another browser, or go back to the arcade.</p><div class="button-row"><a class="text-link" href="/arcade/">All games</a></div>';
    box.hidden = false;
    return;
  }

  const quality = qualityTier();
  const stage = createStage(canvas, {
    fov: 35,
    quality,
    onLost: () => {
      stageEl.classList.remove("is-live");
      const box = $("stage-message");
      box.innerHTML = '<p>The 3D view stopped.</p><div class="button-row"><button type="button" class="button button-small" onclick="location.reload()">Reload the game</button></div>';
      box.hidden = false;
    },
  });
  const view = new ChessView(stage, { quality, reducedMotion });
  stage.onResize = () => view.onResize();

  const prefs = storage.load(PREFS_KEY, { level: "medium", sound: false });
  let game = new Chess();
  let side = "w";
  let level = prefs.level;
  let selected = null;
  let targets = [];
  let busy = false;
  let resigned = false;
  let cursor = null;
  let worker = null;
  let searchId = 0;

  // Restore a saved game, or a dev-only test position.
  const devFen = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("fen");
  const saved = storage.load(GAME_KEY);
  if (devFen) {
    game.load(devFen);
  } else if (saved && Date.now() - saved.updatedAt < MAX_AGE && !saved.resigned) {
    try {
      game.loadPgn(saved.pgn);
      side = saved.side === "b" ? "b" : "w";
      level = saved.level ?? level;
      if (game.isGameOver()) game = new Chess();
    } catch {
      game = new Chess();
    }
  }

  // --- rendering the DOM ---------------------------------------------------

  const pieceName = (color, type) => `${color === "w" ? "white" : "black"} ${NAMES[type]}`;

  function resultText() {
    if (resigned) return "You resigned.";
    if (game.isCheckmate()) return game.turn() === side ? "Checkmate. The bot wins." : "Checkmate. You win.";
    if (game.isStalemate()) return "Draw by stalemate.";
    if (game.isThreefoldRepetition()) return "Draw by repetition.";
    if (game.isInsufficientMaterial()) return "Draw. Neither side can checkmate.";
    if (game.isDrawByFiftyMoves()) return "Draw by the fifty-move rule.";
    return null;
  }

  function isOver() {
    return resigned || game.isGameOver();
  }

  function statusText() {
    const result = resultText();
    if (result) return result;
    if (game.turn() !== side) return "Bot is thinking…";
    return game.inCheck() ? "Check. Your king is under attack." : "Your move.";
  }

  function kingSquare(color) {
    for (const row of game.board()) for (const cell of row) if (cell?.type === "k" && cell.color === color) return cell.square;
    return null;
  }

  function renderMoves() {
    const list = $("move-list");
    const history = game.history();
    list.replaceChildren();
    for (let i = 0; i < history.length; i += 2) {
      const li = document.createElement("li");
      const number = document.createElement("span");
      number.className = "index-number";
      number.textContent = `${i / 2 + 1}.`;
      const white = document.createElement("span");
      white.textContent = history[i];
      const black = document.createElement("span");
      black.textContent = history[i + 1] ?? "";
      if (i === history.length - 1) white.className = "is-last";
      if (i + 1 === history.length - 1) black.className = "is-last";
      li.append(number, white, black);
      list.append(li);
    }
    $("move-list-empty").hidden = history.length > 0;
    list.scrollTop = list.scrollHeight;
  }

  function renderCaptures() {
    const taken = { w: [], b: [] }; // pieces captured by each colour
    for (const move of game.history({ verbose: true })) if (move.captured) taken[move.color].push(move.captured);
    const bot = side === "w" ? "b" : "w";
    const score = (list) => list.reduce((n, t) => n + VALUES[t], 0);
    const diff = score(taken[side]) - score(taken[bot]);
    const row = (el, list, capturedColor, label, lead) => {
      const glyphs = list
        .slice()
        .sort((a, b) => VALUES[b] - VALUES[a])
        .map((t) => GLYPHS[capturedColor][t])
        .join("");
      el.innerHTML = "";
      if (!list.length) return;
      const span = document.createElement("span");
      span.textContent = glyphs;
      span.setAttribute("aria-label", `${label}: ${list.length ? list.map((t) => NAMES[t]).join(", ") : "none"}`);
      el.append(span);
      if (lead > 0) {
        const m = document.createElement("span");
        m.className = "mono";
        m.textContent = `+${lead}`;
        el.append(m);
      }
    };
    row($("captured-by-bot"), taken[bot], side, "Taken by the bot", -diff);
    row($("captured-by-you"), taken[side], bot, "Taken by you", diff);
  }

  function renderHighlights() {
    const history = game.history({ verbose: true });
    const last = history[history.length - 1];
    view.setHighlights({
      selected,
      targets: targets.map((m) => ({ square: m.to, capture: !!m.captured })),
      lastMove: last ? [last.from, last.to] : [],
      check: game.inCheck() ? kingSquare(game.turn()) : null,
      cursor,
    });
  }

  function render() {
    statusEl.textContent = statusText();
    statusEl.classList.toggle("thinking", busy && game.turn() !== side && !isOver());
    const playerTurn = game.turn() === side;
    $("undo").disabled = busy || game.history().length < (side === "w" ? 1 : 2) || resigned;
    $("resign").disabled = busy || isOver() || game.history().length === 0;
    $("move-text").disabled = busy || !playerTurn || isOver();
    const levelInput = document.querySelector(`input[name="level"][value="${level}"]`);
    if (levelInput) levelInput.checked = true;
    renderMoves();
    renderCaptures();
    renderHighlights();
    const over = isOver();
    $("game-over").hidden = !over || $("game-over").dataset.dismissed === "true";
    if (over) $("game-over-title").textContent = resultText();
  }

  function persist() {
    storage.save(GAME_KEY, { pgn: game.pgn(), side, level, updatedAt: Date.now(), resigned });
  }

  // Rebuild the 3D position (after restore, undo, or a new game).
  function rebuildBoard() {
    view.setPosition(game.board());
    const slots = { w: 0, b: 0 };
    for (const move of game.history({ verbose: true })) {
      if (!move.captured) continue;
      const piece = view.addPiece(move.captured, move.color === "w" ? "b" : "w", "a1");
      view.capture(piece, slots[move.color]++, 0, true);
    }
    view.writePieces();
  }

  function trayCount(color) {
    return game.history({ verbose: true }).filter((m) => m.captured && m.color === color).length;
  }

  // --- moves ----------------------------------------------------------------

  function select(square) {
    selected = square;
    targets = square ? game.moves({ square, verbose: true }) : [];
    for (const piece of view.pieces.values()) {
      if (piece.captured) continue;
      const lifted = piece.square === square ? 0.25 : 0;
      if (piece.lift !== lifted) view.liftPiece(piece, lifted);
    }
    renderHighlights();
  }

  function canPick(square) {
    if (busy || isOver() || game.turn() !== side) return false;
    const piece = game.get(square);
    return !!piece && piece.color === side;
  }

  function isTarget(square) {
    return targets.some((m) => m.to === square);
  }

  function choosePromotion() {
    const box = $("promotion");
    box.hidden = false;
    box.querySelector('[data-piece="q"]').focus();
    return new Promise((resolve) => {
      const done = (value) => {
        box.hidden = true;
        box.removeEventListener("click", onClick);
        box.removeEventListener("keydown", onKey);
        canvas.focus({ preventScroll: true });
        resolve(value);
      };
      const onClick = (e) => {
        const button = e.target.closest("[data-piece]");
        if (button) done(button.dataset.piece);
      };
      const onKey = (e) => {
        if (e.key === "Escape") done(null);
      };
      box.addEventListener("click", onClick);
      box.addEventListener("keydown", onKey);
    });
  }

  async function playerMove(from, to) {
    const options = targets.filter((m) => m.from === from && m.to === to);
    if (!options.length) return false;
    let promotion;
    if (options.some((m) => m.promotion)) {
      promotion = await choosePromotion();
      if (!promotion) {
        const piece = view.pieceAt(from);
        if (piece) view.slide(piece, from, { duration: 180 });
        select(null);
        return false;
      }
    }
    const slot = trayCount(side);
    const move = game.move({ from, to, promotion });
    selected = null;
    targets = [];
    busy = true;
    render();
    await view.animateMove(move, slot);
    if (prefs.sound) click();
    busy = false;
    afterMove();
    return true;
  }

  function afterMove() {
    persist();
    render();
    if (game.inCheck()) view.flash(kingSquare(game.turn()));
    if (!isOver() && game.turn() !== side) botTurn();
  }

  function getWorker() {
    if (!worker) {
      worker = new Worker(new URL("./engine.worker.js", import.meta.url), { type: "module" });
    }
    return worker;
  }

  function askBot(fen) {
    const id = ++searchId;
    return new Promise((resolve) => {
      let timer;
      const w = getWorker();
      const onMessage = ({ data }) => {
        if (data.id !== id) return;
        clearTimeout(timer);
        w.removeEventListener("message", onMessage);
        resolve(data.move);
      };
      const fail = () => {
        w.removeEventListener("message", onMessage);
        w.terminate();
        worker = null;
        resolve(null);
      };
      w.addEventListener("message", onMessage);
      w.addEventListener("error", fail, { once: true });
      timer = setTimeout(fail, 5000);
      w.postMessage({ type: "search", id, fen, level });
    });
  }

  async function botTurn() {
    busy = true;
    render();
    const started = performance.now();
    const expected = game.fen();
    let choice = await askBot(expected);
    if (game.fen() !== expected) return; // a new game or undo happened meanwhile
    let note = "";
    if (!choice) {
      const legal = game.moves({ verbose: true });
      choice = legal[Math.floor(Math.random() * legal.length)];
      note = " The bot had trouble thinking, so it made a quick move.";
    }
    const elapsed = performance.now() - started;
    if (elapsed < 350) await wait(350 - elapsed);
    if (game.fen() !== expected) return;
    const slot = trayCount(game.turn());
    const move = game.move({ from: choice.from, to: choice.to, promotion: choice.promotion });
    render();
    await view.animateMove(move, slot);
    if (prefs.sound) click();
    busy = false;
    afterMove();
    if (!isOver()) {
      const said = move.captured
        ? `The bot’s ${NAMES[move.piece]} took your ${NAMES[move.captured]} on ${move.to}.`
        : `Bot played ${NAMES[move.piece]} to ${move.to}.`;
      statusEl.textContent = `${said}${note} ${statusText()}`;
    }
  }

  // --- input ------------------------------------------------------------------

  function onSquare(square) {
    if (!square) return select(null);
    if (selected && isTarget(square)) {
      playerMove(selected, square);
      return;
    }
    if (canPick(square) && square !== selected) select(square);
    else select(null);
  }

  new ChessInput(canvas, stage, view, {
    canPick,
    isTarget,
    onSquare,
    onDragStart(square) {
      if (selected !== square) select(square);
    },
    async onDrop(from, to, piece) {
      if (to && to !== from && isTarget(to)) {
        const moved = await playerMove(from, to);
        if (moved) return;
      }
      if (piece) {
        await view.slide(piece, from, { duration: 220, hop: 0 });
        piece.lift = 0.25;
        view.writePieces();
      }
    },
  });

  // Keyboard cursor on the board.
  const announce = (text) => ($("cursor-status").textContent = text);
  function describe(square) {
    const piece = game.get(square);
    const parts = [square, piece ? pieceName(piece.color, piece.type) : "empty"];
    if (isTarget(square)) parts.push(piece ? "capture" : "legal move");
    return parts.join(", ");
  }
  canvas.addEventListener("focus", () => {
    cursor ??= side === "w" ? "e2" : "e7";
    renderHighlights();
    announce(describe(cursor));
  });
  canvas.addEventListener("blur", () => {
    cursor = null;
    renderHighlights();
  });
  canvas.addEventListener("keydown", (e) => {
    const dirs = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (dirs[e.key] && cursor) {
      e.preventDefault();
      const flip = view.flipped ? -1 : 1;
      const [df, dr] = dirs[e.key];
      const file = Math.max(0, Math.min(7, "abcdefgh".indexOf(cursor[0]) + df * flip));
      const rank = Math.max(1, Math.min(8, Number(cursor[1]) + dr * flip));
      cursor = "abcdefgh"[file] + rank;
      renderHighlights();
      announce(describe(cursor));
    } else if ((e.key === "Enter" || e.key === " ") && cursor) {
      e.preventDefault();
      onSquare(cursor);
      announce(selected ? `${describe(selected)} picked up. ${targets.length} legal moves.` : describe(cursor));
    } else if (e.key === "Escape" && selected) {
      e.preventDefault();
      select(null);
      announce("Piece put back.");
    }
  });

  // Typed moves.
  $("move-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("move-text").value.trim();
    const error = $("move-error");
    if (!text || busy || game.turn() !== side || isOver()) return;
    const probe = new Chess(game.fen());
    let move;
    try {
      move = probe.move(text, { strict: false });
    } catch {
      move = null;
    }
    if (!move) {
      const from = /^[a-h][1-8]/.test(text) ? text.slice(0, 2) : null;
      const legal = from ? game.moves({ square: from }) : [];
      error.textContent = legal.length
        ? `That move isn’t legal here. Legal moves for this piece: ${legal.join(", ")}.`
        : "That move isn’t legal here.";
      return;
    }
    error.textContent = "";
    $("move-text").value = "";
    targets = game.moves({ square: move.from, verbose: true });
    selected = move.from;
    playerMove(move.from, move.to);
  });

  // --- buttons ----------------------------------------------------------------

  function newGame(chosenSide, chosenLevel) {
    searchId++;
    game = new Chess();
    side = chosenSide === "random" ? (Math.random() < 0.5 ? "w" : "b") : chosenSide;
    level = chosenLevel;
    prefs.level = level;
    storage.save(PREFS_KEY, prefs);
    resigned = false;
    busy = false;
    selected = null;
    targets = [];
    $("game-over").dataset.dismissed = "false";
    rebuildBoard();
    view.setFlipped(side === "b");
    persist();
    render();
    if (game.turn() !== side) botTurn();
  }

  const dialog = $("new-game-dialog");
  $("new-game").addEventListener("click", () => {
    dialog.querySelector(`input[name="side"][value="${side}"]`).checked = true;
    dialog.querySelector(`input[name="dialog-level"][value="${level}"]`).checked = true;
    dialog.showModal();
  });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "start") return;
    const data = new FormData($("new-game-form"));
    newGame(data.get("side"), data.get("dialog-level"));
  });
  $("play-again").addEventListener("click", () => newGame(side, level));
  $("review").addEventListener("click", () => {
    $("game-over").dataset.dismissed = "true";
    render();
  });

  $("undo").addEventListener("click", undo);
  function undo() {
    if ($("undo").disabled) return;
    game.undo();
    if (game.turn() !== side) game.undo();
    selected = null;
    targets = [];
    rebuildBoard();
    persist();
    render();
  }

  $("resign").addEventListener("click", () => {
    $("resign-confirm").hidden = false;
    $("resign-no").focus();
  });
  $("resign-no").addEventListener("click", () => {
    $("resign-confirm").hidden = true;
    $("resign").focus();
  });
  $("resign-yes").addEventListener("click", () => {
    $("resign-confirm").hidden = true;
    resigned = true;
    searchId++;
    busy = false;
    $("game-over").dataset.dismissed = "false";
    persist();
    render();
    $("play-again").focus();
  });

  $("flip").addEventListener("click", () => view.setFlipped(!view.flipped));
  $("top-view").addEventListener("click", (e) => {
    const on = !view.top;
    e.currentTarget.setAttribute("aria-pressed", String(on));
    e.currentTarget.textContent = on ? "Angled view" : "Top view";
    view.setTopView(on);
  });

  document.querySelectorAll('input[name="level"]').forEach((input) =>
    input.addEventListener("change", () => {
      level = input.value;
      prefs.level = level;
      storage.save(PREFS_KEY, prefs);
      persist();
    }),
  );

  const sound = $("sound");
  sound.checked = prefs.sound;
  sound.addEventListener("change", () => {
    prefs.sound = sound.checked;
    storage.save(PREFS_KEY, prefs);
    if (sound.checked) click();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.target.closest("input")) {
      e.preventDefault();
      undo();
    }
  });

  window.addEventListener("pagehide", (event) => {
    persist();
    if (!event.persisted) {
      worker?.terminate();
      stage.dispose();
    }
  });

  rebuildBoard();
  view.flipped = side === "b";
  view.refreshCoordinates();
  view.placeCamera(false);
  document.fonts.ready.then(() => view.refreshCoordinates());
  render();
  stage.ready.then(() => stageEl.classList.add("is-live"));
  if (!isOver() && game.turn() !== side) botTurn();
}

start();
