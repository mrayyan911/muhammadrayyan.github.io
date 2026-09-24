// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { CubeModel, parse, format, invert, scramble, rotateVec } from "../assets/arcade/cube/model.js";

const run = (text, cube = new CubeModel()) => {
  for (const move of parse(text)) cube.apply(move);
  return cube;
};

test("a new cube is solved", () => {
  assert.equal(new CubeModel().isSolved(), true);
});

test("one quarter turn unsolves, four solve again", () => {
  assert.equal(run("R").isSolved(), false);
  assert.equal(run("R R R R").isSolved(), true);
});

test("every move followed by its inverse is identity", () => {
  for (const letter of "RLUDFBMESxyz") {
    for (const suffix of ["", "'", "2"]) {
      const moves = parse(letter + suffix);
      const cube = new CubeModel();
      for (const m of [...moves, ...invert(moves)]) cube.apply(m);
      assert.equal(cube.isSolved(), true, letter + suffix);
      assert.deepEqual(cube.serialize(), new CubeModel().serialize(), letter + suffix);
    }
  }
});

test("the sexy move six times is identity", () => {
  assert.equal(run("R U R' U' ".repeat(6)).isSolved(), true);
  assert.equal(run("R U R' U' ".repeat(3)).isSolved(), false);
});

test("R moves front stickers up (clockwise seen from the right)", () => {
  const cube = run("R");
  const corner = cube.cubies.find((c) => c.home.join() === "1,1,1");
  assert.deepEqual(corner.pos, [1, 1, -1]);
  const front = corner.stickers.find((s) => s.face === "F");
  assert.deepEqual(cube.worldNormal(corner, front), [0, 1, 0]);
});

test("U turns the front face to the left", () => {
  const cube = run("U");
  const edge = cube.cubies.find((c) => c.home.join() === "0,1,1");
  assert.deepEqual(edge.pos, [-1, 1, 0]);
});

test("whole-cube rotations keep the cube solved", () => {
  assert.equal(run("x y z x' y2").isSolved(), true);
});

test("slice moves match their face equivalents", () => {
  // M = L' R x' (as a state, ignoring orientation)
  assert.equal(run("M R' L x").isSolved(), true);
});

test("parse and format round-trip", () => {
  const text = "R U2 F' B L2 D' M E' S2 x y' z2";
  assert.equal(format(parse(text)), text);
});

test("scramble followed by its inverse is solved", () => {
  for (let i = 0; i < 200; i++) {
    const moves = scramble(25);
    const cube = new CubeModel();
    moves.forEach((m) => cube.apply(m));
    invert(moves).forEach((m) => cube.apply(m));
    assert.equal(cube.isSolved(), true);
  }
});

test("scrambles follow the repeat rules", () => {
  const axis = { U: 1, D: 1, L: 0, R: 0, F: 2, B: 2 };
  for (let i = 0; i < 10000; i++) {
    const faces = format(scramble(25)).split(" ").map((t) => t[0]);
    assert.equal(faces.length, 25);
    for (let j = 1; j < faces.length; j++) {
      assert.notEqual(faces[j], faces[j - 1]);
      if (j > 1) {
        assert.ok(!(axis[faces[j]] === axis[faces[j - 1]] && axis[faces[j - 1]] === axis[faces[j - 2]]));
      }
    }
  }
});

test("quarter-turn vector rotation", () => {
  assert.deepEqual(rotateVec([0, 1, 0], 0, 1), [0, 0, 1]);
  assert.deepEqual(rotateVec([1, 0, 0], 1, 1), [0, 0, -1]);
  assert.deepEqual(rotateVec([1, 0, 0], 2, 1), [0, 1, 0]);
});
