// Pure Rubik's cube logic with integer state, so turns never drift.
// Axes: x → R, y → U, z → F. A quarter turn k = +1 is +90° about the positive
// axis (right-hand rule). Imported by the view and by the Node tests.

export const FACE_COLORS = {
  U: 0xf3f0e9,
  D: 0xe3be45,
  F: 0x4f7a52,
  B: 0x2f5d8a,
  R: 0xb93422,
  L: 0xe0843a,
};

// face letter → [axis, sign of the outward normal]
const FACE_NORMALS = { R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1] };

// Notation: [axis, layers, quarter-turn sign for the clockwise move]
const NOTATION = {
  R: [0, [1], -1],
  L: [0, [-1], 1],
  M: [0, [0], 1],
  U: [1, [1], -1],
  D: [1, [-1], 1],
  E: [1, [0], 1],
  F: [2, [1], -1],
  B: [2, [-1], 1],
  S: [2, [0], -1],
  x: [0, [-1, 0, 1], -1],
  y: [1, [-1, 0, 1], -1],
  z: [2, [-1, 0, 1], -1],
};

// Rotate an integer vector by k quarter turns about an axis.
export function rotateVec(v, axis, k) {
  let [x, y, z] = v;
  const turns = ((k % 4) + 4) % 4;
  for (let i = 0; i < turns; i++) {
    if (axis === 0) [y, z] = [-z, y];
    else if (axis === 1) [x, z] = [z, -x];
    else [x, y] = [-y, x];
  }
  return [x + 0, y + 0, z + 0];
}

// Rotation matrices are stored as three column vectors (images of the basis).
function rotateMatrix(columns, axis, k) {
  return columns.map((c) => rotateVec(c, axis, k));
}

function applyMatrix(columns, v) {
  return [0, 1, 2].map((i) => columns[0][i] * v[0] + columns[1][i] * v[1] + columns[2][i] * v[2] + 0);
}

export function createMove(axis, layers, k) {
  const move = { axis, layers: [...layers].sort((a, b) => a - b), k: normalizeK(k) };
  move.name = nameOf(move);
  return move;
}

function normalizeK(k) {
  const t = ((k % 4) + 4) % 4;
  return t === 3 ? -1 : t;
}

function nameOf({ axis, layers, k }) {
  for (const [letter, [a, ls, sign]] of Object.entries(NOTATION)) {
    if (a !== axis || ls.length !== layers.length || !ls.every((l, i) => l === layers[i])) continue;
    if (k === 2) return `${letter}2`;
    return k === sign ? letter : `${letter}'`;
  }
  return null;
}

export function parse(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = /^([RLUDFBMESxyz])(2|'|’)?$/.exec(token);
      if (!match) throw new Error(`Unknown move: ${token}`);
      const [axis, layers, sign] = NOTATION[match[1]];
      const k = match[2] === "2" ? 2 : match[2] ? -sign : sign;
      return createMove(axis, layers, k);
    });
}

export function format(moves) {
  return moves.map((m) => m.name ?? "?").join(" ");
}

export function invert(moves) {
  return moves
    .slice()
    .reverse()
    .map((m) => createMove(m.axis, m.layers, m.k === 2 ? 2 : -m.k));
}

// Random face turns: never the same face twice in a row, never three turns
// on one axis in a row (rules out R L R).
export function scramble(length = 25, random = secureRandom) {
  const faces = ["U", "D", "L", "R", "F", "B"];
  const axisOf = { U: 1, D: 1, L: 0, R: 0, F: 2, B: 2 };
  const suffixes = ["", "'", "2"];
  const tokens = [];
  let prev = null;
  let prevPrev = null;
  while (tokens.length < length) {
    const face = faces[Math.floor(random() * faces.length)];
    if (face === prev) continue;
    if (prev && prevPrev && axisOf[face] === axisOf[prev] && axisOf[prev] === axisOf[prevPrev]) continue;
    tokens.push(face + suffixes[Math.floor(random() * 3)]);
    prevPrev = prev;
    prev = face;
  }
  return parse(tokens.join(" "));
}

function secureRandom() {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}

export class CubeModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.cubies = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const stickers = [];
          for (const [face, [axis, sign]] of Object.entries(FACE_NORMALS)) {
            if ([x, y, z][axis] === sign) {
              const normal = [0, 0, 0];
              normal[axis] = sign;
              stickers.push({ face, normal });
            }
          }
          this.cubies.push({
            id: this.cubies.length,
            home: [x, y, z],
            pos: [x, y, z],
            rot: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
            stickers,
          });
        }
  }

  layerCubies(axis, layers) {
    return this.cubies.filter((c) => layers.includes(c.pos[axis]));
  }

  apply(move) {
    for (const cubie of this.layerCubies(move.axis, move.layers)) {
      cubie.pos = rotateVec(cubie.pos, move.axis, move.k);
      cubie.rot = rotateMatrix(cubie.rot, move.axis, move.k);
    }
  }

  worldNormal(cubie, sticker) {
    return applyMatrix(cubie.rot, sticker.normal);
  }

  // Solved means every outward direction shows a single colour; the whole
  // cube's orientation doesn't matter.
  isSolved() {
    const seen = new Map();
    for (const cubie of this.cubies) {
      for (const sticker of cubie.stickers) {
        const key = this.worldNormal(cubie, sticker).join(",");
        const face = seen.get(key);
        if (face === undefined) seen.set(key, sticker.face);
        else if (face !== sticker.face) return false;
      }
    }
    return true;
  }

  serialize() {
    return this.cubies.map((c) => [c.pos, c.rot]);
  }

  restore(data) {
    if (!Array.isArray(data) || data.length !== this.cubies.length) return false;
    data.forEach(([pos, rot], i) => {
      this.cubies[i].pos = pos;
      this.cubies[i].rot = rot;
    });
    return true;
  }
}
