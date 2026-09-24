// The chess bot. Negamax alpha-beta with iterative deepening, quiescence,
// a transposition table, and PeSTO evaluation. Runs off the main thread.
// Uses chess.js 1.4.0 internals (_moves, _makeMove, _undoMove, _board) for
// speed; they are stable within this pinned version.
import { Chess } from "../../vendor/chess.js@1.4.0/chess.js";
import { bookMove } from "./book.js";

const MATE = 100000;
const INF = 1e9;
const PIECE_INDEX = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
const MG_VALUE = [82, 337, 365, 477, 1025, 0];
const EG_VALUE = [94, 281, 297, 512, 936, 0];
const PHASE = [0, 1, 1, 2, 4, 0];
const ORDER_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 10 };

// PeSTO tables, a8 first (white's view).
// prettier-ignore
const MG = [
  [0,0,0,0,0,0,0,0,98,134,61,95,68,126,34,-11,-6,7,26,31,65,56,25,-20,-14,13,6,21,23,12,17,-23,-27,-2,-5,12,17,6,10,-25,-26,-4,-4,-10,3,3,33,-12,-35,-1,-20,-23,-15,24,38,-22,0,0,0,0,0,0,0,0],
  [-167,-89,-34,-49,61,-97,-15,-107,-73,-41,72,36,23,62,7,-17,-47,60,37,65,84,129,73,44,-9,17,19,53,37,69,18,22,-13,4,16,13,28,19,21,-8,-23,-9,12,10,19,17,25,-16,-29,-53,-12,-3,-1,18,-14,-19,-105,-21,-58,-33,-17,-28,-19,-23],
  [-29,4,-82,-37,-25,-42,7,-8,-26,16,-18,-13,30,59,18,-47,-16,37,43,40,35,50,37,-2,-4,5,19,50,37,37,7,-2,-6,13,13,26,34,12,10,4,0,15,15,15,14,27,18,10,4,15,16,0,7,21,33,1,-33,-3,-14,-21,-13,-12,-39,-21],
  [32,42,32,51,63,9,31,43,27,32,58,62,80,67,26,44,-5,19,26,36,17,45,61,16,-24,-11,7,26,24,35,-8,-20,-36,-26,-12,-1,9,-7,6,-23,-45,-25,-16,-17,3,0,-5,-33,-44,-16,-20,-9,-1,11,-6,-71,-19,-13,1,17,16,7,-37,-26],
  [-28,0,29,12,59,44,43,45,-24,-39,-5,1,-16,57,28,54,-13,-17,7,8,29,56,47,57,-27,-27,-16,-16,-1,17,-2,1,-9,-26,-9,-10,-2,-4,3,-3,-14,2,-11,-2,-5,2,14,5,-35,-8,11,2,8,15,-3,1,-1,-18,-9,10,-15,-25,-31,-50],
  [-65,23,16,-15,-56,-34,2,13,29,-1,-20,-7,-8,-4,-38,-29,-9,24,2,-16,-20,6,22,-22,-17,-20,-12,-27,-30,-25,-14,-36,-49,-1,-27,-39,-46,-44,-33,-51,-14,-14,-22,-46,-44,-30,-15,-27,1,7,-8,-64,-43,-16,9,8,-15,36,12,-54,8,-28,24,14],
];
// prettier-ignore
const EG = [
  [0,0,0,0,0,0,0,0,178,173,158,134,147,132,165,187,94,100,85,67,56,53,82,84,32,24,13,5,-2,4,17,17,13,9,-3,-7,-7,-8,3,-1,4,7,-6,1,0,-5,-1,-8,13,8,8,10,13,0,2,-7,0,0,0,0,0,0,0,0],
  [-58,-38,-13,-28,-31,-27,-63,-99,-25,-8,-25,-2,-9,-25,-24,-52,-24,-20,10,9,-1,-9,-19,-41,-17,3,22,22,22,11,8,-18,-18,-6,16,25,16,17,4,-18,-23,-3,-1,15,10,-3,-20,-22,-42,-20,-10,-5,-2,-20,-23,-44,-29,-51,-23,-15,-22,-18,-50,-64],
  [-14,-21,-11,-8,-7,-9,-17,-24,-8,-4,7,-12,-3,-13,-4,-14,2,-8,0,-1,-2,6,0,4,-3,9,12,9,14,10,3,2,-6,3,13,19,7,10,-3,-9,-12,-3,8,10,13,3,-7,-15,-14,-18,-7,-1,4,-9,-15,-27,-23,-9,-23,-5,-9,-16,-5,-17],
  [13,10,18,15,12,12,8,5,11,13,13,11,-3,3,8,3,7,7,7,5,4,-3,-5,-3,4,3,13,1,2,1,-1,2,3,5,8,4,-5,-6,-8,-11,-4,0,-5,-1,-7,-12,-8,-16,-6,-6,0,2,-9,-9,-11,-3,-9,2,3,-1,-5,-13,4,-20],
  [-9,22,22,27,27,19,10,20,-17,20,32,41,58,25,30,0,-20,6,9,49,47,35,19,9,3,22,24,45,57,40,57,36,-18,28,19,47,31,34,39,23,-16,-27,15,6,9,17,10,5,-22,-23,-30,-16,-16,-23,-36,-32,-33,-28,-22,-43,-5,-32,-20,-41],
  [-74,-35,-18,-18,-11,15,4,-17,-12,17,14,17,17,38,23,11,10,17,23,15,20,45,44,13,-8,22,24,27,26,33,26,3,-18,-4,21,24,27,23,9,-11,-19,-3,11,21,23,16,7,-9,-27,-11,4,13,14,4,-5,-17,-53,-34,-21,-11,-28,-14,-24,-43],
];

const LEVELS = {
  easy: { maxDepth: 1, time: 400, multi: true },
  medium: { maxDepth: 3, time: 600, multi: true },
  hard: { maxDepth: 8, time: 1500, multi: false },
};

export function evaluate(game) {
  let mg = 0;
  let eg = 0;
  let phase = 0;
  const board = game._board;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const piece = board[sq];
    if (!piece) continue;
    const i = PIECE_INDEX[piece.type];
    const idx = (sq >> 4) * 8 + (sq & 7);
    if (piece.color === "w") {
      mg += MG_VALUE[i] + MG[i][idx];
      eg += EG_VALUE[i] + EG[i][idx];
    } else {
      mg -= MG_VALUE[i] + MG[i][idx ^ 56];
      eg -= EG_VALUE[i] + EG[i][idx ^ 56];
    }
    phase += PHASE[i];
  }
  const p = Math.min(phase, 24);
  const score = (mg * p + eg * (24 - p)) / 24;
  return (game._turn === "w" ? score : -score) + 10;
}

function sameMove(a, b) {
  return a && b && a.from === b.from && a.to === b.to && a.promotion === b.promotion;
}

function algebraic(sq) {
  return "abcdefgh"[sq & 7] + (8 - (sq >> 4));
}

export class Searcher {
  constructor() {
    this.tt = new Map();
  }

  run(fen, { maxDepth, time, multi }) {
    this.game = new Chess(fen);
    this.deadline = performance.now() + time;
    this.nodes = 0;
    this.stopped = false;
    this.killers = [];
    this.history = new Map();
    if (this.tt.size > 200000) this.tt.clear();

    let best = null;
    let scores = null;
    let depthReached = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const result = this.root(depth, multi && depth === maxDepth);
      if (this.stopped && depth > 1) break;
      best = result.best;
      scores = result.scores;
      depthReached = depth;
      if (Math.abs(result.score) > MATE - 100) break;
      if (performance.now() > this.deadline) break;
    }
    return { best, scores, depth: depthReached, nodes: this.nodes };
  }

  ordered(moves, ply, hashMove) {
    const killers = this.killers[ply] || [];
    return moves
      .map((m) => {
        let score = 0;
        if (sameMove(m, hashMove)) score = 1e7;
        else if (m.captured) score = 1e6 + ORDER_VALUE[m.captured] * 10 - ORDER_VALUE[m.piece];
        else if (m.promotion) score = 9e5;
        else if (sameMove(m, killers[0]) || sameMove(m, killers[1])) score = 8e5;
        else score = this.history.get(m.from * 128 + m.to) || 0;
        return { m, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.m);
  }

  root(depth, multi) {
    const game = this.game;
    const entry = this.tt.get(game._hash);
    const moves = this.ordered(game._moves({ legal: true }), 0, entry?.move);
    let alpha = -INF;
    let best = moves[0];
    const scores = [];
    for (const move of moves) {
      game._makeMove(move);
      // Multi mode gives every root move an exact score, for varied play.
      const score = -this.negamax(depth - 1, -INF, multi ? INF : -alpha, 1);
      game._undoMove();
      if (this.stopped && depth > 1) break;
      scores.push({ move, score });
      if (score > alpha) {
        alpha = score;
        best = move;
      }
    }
    this.tt.set(game._hash, { depth, score: alpha, flag: 0, move: best });
    return { best, score: alpha, scores };
  }

  checkTime() {
    if ((++this.nodes & 1023) === 0 && performance.now() > this.deadline) this.stopped = true;
    return this.stopped;
  }

  negamax(depth, alpha, beta, ply) {
    if (this.checkTime()) return 0;
    const game = this.game;
    if (game._halfMoves >= 100) return 0;
    const alphaStart = alpha;
    const entry = this.tt.get(game._hash);
    if (entry && entry.depth >= depth) {
      if (entry.flag === 0) return entry.score;
      if (entry.flag === 1 && entry.score >= beta) return entry.score;
      if (entry.flag === -1 && entry.score <= alpha) return entry.score;
    }
    const inCheck = game._isKingAttacked(game._turn);
    if (depth <= 0 && !inCheck) return this.quiesce(alpha, beta, ply, 0);

    const us = game._turn;
    const moves = this.ordered(game._moves({ legal: false }), ply, entry?.move);
    let legal = 0;
    let best = -INF;
    let bestMove = null;
    for (const move of moves) {
      game._makeMove(move);
      if (game._isKingAttacked(us)) {
        game._undoMove();
        continue;
      }
      legal++;
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      game._undoMove();
      if (this.stopped) return 0;
      if (score > best) {
        best = score;
        bestMove = move;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!move.captured) {
          const k = (this.killers[ply] ||= []);
          if (!sameMove(k[0], move)) {
            k[1] = k[0];
            k[0] = move;
          }
          const key = move.from * 128 + move.to;
          this.history.set(key, (this.history.get(key) || 0) + depth * depth);
        }
        break;
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;
    const flag = best <= alphaStart ? -1 : best >= beta ? 1 : 0;
    this.tt.set(game._hash, { depth, score: best, flag, move: bestMove });
    return best;
  }

  quiesce(alpha, beta, ply, qdepth) {
    if (this.checkTime()) return 0;
    const game = this.game;
    const stand = evaluate(game);
    if (stand >= beta || qdepth >= 6) return stand;
    if (stand > alpha) alpha = stand;
    const us = game._turn;
    const captures = game
      ._moves({ legal: false })
      .filter((m) => m.captured || m.promotion)
      .sort((a, b) => ORDER_VALUE[b.captured || "p"] * 10 - ORDER_VALUE[b.piece] - (ORDER_VALUE[a.captured || "p"] * 10 - ORDER_VALUE[a.piece]));
    for (const move of captures) {
      game._makeMove(move);
      if (game._isKingAttacked(us)) {
        game._undoMove();
        continue;
      }
      const score = -this.quiesce(-beta, -alpha, ply + 1, qdepth + 1);
      game._undoMove();
      if (this.stopped) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }
}

function pick(level, result, random = Math.random) {
  const { best, scores } = result;
  if (!scores || scores.length < 2 || level === "hard") return best;
  // Varied play shouldn't mean odd underpromotions.
  const sorted = scores.filter((s) => !s.move.promotion || s.move.promotion === "q").sort((a, b) => b.score - a.score);
  if (!sorted.length) return best;
  const top = sorted[0].score;
  // Never pass up the fastest forced mate.
  if (top > MATE - 100) return sorted[0].move;
  if (level === "medium") {
    const close = sorted.filter((s) => s.score >= top - 20);
    return close[Math.floor(random() * close.length)].move;
  }
  // Easy: softmax over root moves, sometimes a random move that isn't a blunder.
  if (random() < 0.15) {
    const safe = sorted.filter((s) => s.score >= top - 200);
    return safe[Math.floor(random() * safe.length)].move;
  }
  const temperature = 120;
  const weights = sorted.map((s) => Math.exp((Math.max(s.score, top - 2000) - top) / temperature));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < sorted.length; i++) {
    r -= weights[i];
    if (r <= 0) return sorted[i].move;
  }
  return sorted[0].move;
}

export function chooseMove(fen, level, searcher = new Searcher()) {
  const book = bookMove(fen);
  if (book) return { move: book, depth: 0, nodes: 0, book: true };
  const settings = LEVELS[level] ?? LEVELS.medium;
  const result = searcher.run(fen, settings);
  const move = pick(level, result);
  return {
    move: move && { from: algebraic(move.from), to: algebraic(move.to), promotion: move.promotion },
    depth: result.depth,
    nodes: result.nodes,
  };
}

// Worker entry point (skipped when imported by the Node tests).
if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  const searcher = new Searcher();
  self.onmessage = ({ data }) => {
    if (data?.type !== "search") return;
    const result = chooseMove(data.fen, data.level, searcher);
    self.postMessage({ type: "best", id: data.id, ...result });
  };
}
