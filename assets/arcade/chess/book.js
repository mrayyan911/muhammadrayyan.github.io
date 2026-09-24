// A small opening book, so the bot varies its first moves at every level.
import { Chess } from "../../vendor/chess.js@1.4.0/chess.js";

const LINES = [
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7",
  "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6",
  "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7",
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6",
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4",
  "e4 e5 Nc3 Nf6 f4 d5",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6",
  "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7",
  "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4",
  "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7",
  "e4 e6 d4 d5 e5 c5 c3 Nc6",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5",
  "e4 c6 d4 d5 e5 Bf5 Nf3 e6",
  "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6",
  "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7",
  "e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4",
  "e4 g6 d4 Bg7 Nc3 d6 Be3 a6",
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4",
  "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6",
  "d4 d5 Nf3 Nf6 Bf4 e6 e3 c5",
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6",
  "d4 Nf6 c4 e6 Nf3 b6 g3 Bb7",
  "d4 Nf6 c4 c5 d5 e6 Nc3 exd5",
  "d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7",
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5",
  "c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7",
  "c4 Nf6 Nc3 e6 e4 d5",
  "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7",
  "Nf3 Nf6 c4 g6 Nc3 Bg7",
];

let book;

// Positions are keyed by piece placement, side, castling, and en passant.
const key = (fen) => fen.split(" ").slice(0, 4).join(" ");

function build() {
  book = new Map();
  for (const line of LINES) {
    const game = new Chess();
    for (const san of line.split(" ")) {
      const k = key(game.fen());
      const move = game.move(san);
      const list = book.get(k) ?? [];
      if (!list.some((m) => m.from === move.from && m.to === move.to)) {
        list.push({ from: move.from, to: move.to, promotion: move.promotion });
      }
      book.set(k, list);
    }
  }
}

export function bookMove(fen, random = Math.random) {
  if (!book) build();
  const moves = book.get(key(fen));
  return moves ? moves[Math.floor(random() * moves.length)] : null;
}
