// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../assets/vendor/chess.js@1.4.0/chess.js";
import { chooseMove, Searcher } from "../assets/arcade/chess/engine.worker.js";

const MATE_IN_ONE = [
  "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
  "k7/8/1K6/8/8/8/8/7Q w - - 0 1",
  "r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
  "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1",
  "k7/pp6/8/8/8/8/8/K6R w - - 0 1",
  "8/8/8/8/8/6k1/4q3/7K b - - 0 1",
];

function play(fen, move) {
  const game = new Chess(fen);
  game.move(move);
  return game;
}

test("finds mate in one at medium and hard", () => {
  for (const level of ["medium", "hard"]) {
    for (const fen of MATE_IN_ONE) {
      const { move } = chooseMove(fen, level);
      assert.ok(play(fen, move).isCheckmate(), `${level}: ${fen} played ${move.from}${move.to}`);
    }
  }
});

test("finds a two-rook mate in two at hard", () => {
  const fen = "7k/8/8/8/8/8/R7/1R4K1 w - - 0 1";
  const game = play(fen, chooseMove(fen, "hard").move);
  for (const reply of game.moves({ verbose: true })) {
    game.move(reply);
    const after = game.fen();
    const { move } = chooseMove(after, "hard");
    assert.ok(play(after, move).isCheckmate(), `after ${reply.san}`);
    game.undo();
  }
});

test("returns a legal move in 200 random positions", () => {
  const searcher = new Searcher();
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let checked = 0;
  while (checked < 200) {
    const game = new Chess();
    const plies = 4 + Math.floor(random() * 40);
    for (let i = 0; i < plies && !game.isGameOver(); i++) {
      const moves = game.moves();
      game.move(moves[Math.floor(random() * moves.length)]);
    }
    if (game.isGameOver()) continue;
    const result = searcher.run(game.fen(), { maxDepth: 3, time: 40, multi: false });
    const legal = game._moves({ legal: true });
    assert.ok(legal.some((m) => m.from === result.best.from && m.to === result.best.to), game.fen());
    checked++;
  }
});

test("hard stays within its time budget", () => {
  const fen = "r2q1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R2Q1RK1 w - - 0 10";
  const start = performance.now();
  const { move } = chooseMove(fen, "hard");
  const elapsed = performance.now() - start;
  assert.ok(move);
  assert.ok(elapsed < 1650, `took ${Math.round(elapsed)} ms`);
});

test("easy still plays legal moves", () => {
  const fen = "r2q1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R2Q1RK1 w - - 0 10";
  for (let i = 0; i < 10; i++) {
    const { move } = chooseMove(fen, "easy");
    assert.ok(new Chess(fen).move(move));
  }
});

test("the book answers the opening instantly", () => {
  const { book, move } = chooseMove(new Chess().fen(), "hard");
  assert.equal(book, true);
  assert.ok(new Chess().move(move));
});
