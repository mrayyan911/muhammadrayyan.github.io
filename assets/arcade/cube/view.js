// The cube as three instanced meshes: bodies, stickers, and optional face
// letters. Layer turns only rewrite the ~9 affected instances per frame.
import {
  CanvasTexture,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { blobTexture } from "../core/stage.js";
import { ease } from "../core/tween.js";
import { FACE_COLORS, createMove, invert } from "./model.js";

const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
const LETTERS = ["U", "D", "F", "B", "R", "L"];
const DARK_FACES = new Set(["F", "B", "R"]);
const STICKER_OFFSET = 0.483;
export const DEFAULT_ORIENTATION = new Quaternion()
  .setFromAxisAngle(AXES[0], (25 * Math.PI) / 180)
  .multiply(new Quaternion().setFromAxisAngle(AXES[1], (-35 * Math.PI) / 180));

function roundedSquare(size, radius) {
  const h = size / 2;
  const shape = new Shape();
  shape.moveTo(-h + radius, -h);
  shape.lineTo(h - radius, -h);
  shape.quadraticCurveTo(h, -h, h, -h + radius);
  shape.lineTo(h, h - radius);
  shape.quadraticCurveTo(h, h, h - radius, h);
  shape.lineTo(-h + radius, h);
  shape.quadraticCurveTo(-h, h, -h, h - radius);
  shape.lineTo(-h, -h + radius);
  shape.quadraticCurveTo(-h, -h, -h + radius, -h);
  return new ShapeGeometry(shape, 4);
}

// Rotation taking the sticker plane's +z to the given outward normal.
function faceMatrix(normal) {
  const n = new Vector3(...normal);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n);
  return new Matrix4().makeRotationFromQuaternion(q).setPosition(n.multiplyScalar(STICKER_OFFSET));
}

function letterAtlas() {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cell * LETTERS.length;
  canvas.height = cell;
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${cell * 0.46}px "DM Mono", Consolas, monospace`;
  LETTERS.forEach((letter, i) => {
    ctx.fillStyle = DARK_FACES.has(letter) ? "#f3f0e9" : "#25251f";
    ctx.fillText(letter, cell * (i + 0.5), cell * 0.54);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class CubeView {
  constructor(stage, model, { quality, reducedMotion }) {
    this.stage = stage;
    this.model = model;
    this.reducedMotion = reducedMotion;
    this.queue = [];
    this.busy = false;
    this.onMove = null;

    this.root = new Group();
    this.group = new Group();
    this.group.quaternion.copy(DEFAULT_ORIENTATION);
    this.root.add(this.group);
    stage.scene.add(this.root);

    const Material = quality.low ? MeshLambertMaterial : MeshStandardMaterial;
    const bodyMaterial = new Material({ color: 0x25251f });
    const stickerMaterial = new Material({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    if (!quality.low) {
      bodyMaterial.roughness = 0.55;
      stickerMaterial.roughness = 0.38;
    }

    this.bodies = new InstancedMesh(new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.09), bodyMaterial, model.cubies.length);
    this.stickerList = [];
    for (const cubie of model.cubies) {
      for (const sticker of cubie.stickers) {
        this.stickerList.push({ cubie, local: faceMatrix(sticker.normal), face: sticker.face });
      }
    }
    this.stickers = new InstancedMesh(roundedSquare(0.8, 0.12), stickerMaterial, this.stickerList.length);
    const color = new Color();
    this.stickerList.forEach((s, i) => this.stickers.setColorAt(i, color.setHex(FACE_COLORS[s.face])));
    this.stickers.instanceColor.needsUpdate = true;
    this.group.add(this.bodies, this.stickers);

    const shadow = new Mesh(
      new PlaneGeometry(5.2, 5.2),
      new MeshBasicMaterial({ map: blobTexture(128, 0.5), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -2.35;
    this.shadow = shadow;
    stage.scene.add(shadow);

    this.cubieMatrices = model.cubies.map(() => new Matrix4());
    this.sync();
  }

  // Face letters are built lazily, after fonts load.
  setLetters(on) {
    if (on && !this.letters) {
      const material = new MeshBasicMaterial({ map: letterAtlas(), transparent: true, depthWrite: false });
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace("void main() {", "attribute float letterIndex;\nvoid main() {")
          .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv.x = (vMapUv.x + letterIndex) / 6.0;");
      };
      const geometry = new PlaneGeometry(0.46, 0.46);
      const index = new Float32Array(this.stickerList.map((s) => LETTERS.indexOf(s.face)));
      geometry.setAttribute("letterIndex", new InstancedBufferAttribute(index, 1));
      this.letters = new InstancedMesh(geometry, material, this.stickerList.length);
      this.letterLift = new Matrix4().makeTranslation(0, 0, 0.004);
      this.group.add(this.letters);
      this.writeInstances();
    }
    if (this.letters) this.letters.visible = on;
    this.stage.invalidate();
  }

  cubieMatrix(cubie, target) {
    const [c0, c1, c2] = cubie.rot;
    target.makeBasis(new Vector3(...c0), new Vector3(...c1), new Vector3(...c2));
    target.setPosition(cubie.pos[0], cubie.pos[1], cubie.pos[2]);
    return target;
  }

  sync() {
    this.model.cubies.forEach((cubie, i) => this.cubieMatrix(cubie, this.cubieMatrices[i]));
    this.writeInstances();
  }

  writeInstances(only) {
    const m = new Matrix4();
    const ids = only ? new Set(only) : null;
    this.model.cubies.forEach((cubie, i) => {
      if (!ids || ids.has(i)) this.bodies.setMatrixAt(i, this.cubieMatrices[i]);
    });
    this.stickerList.forEach((s, i) => {
      if (ids && !ids.has(s.cubie.id)) return;
      m.multiplyMatrices(this.cubieMatrices[s.cubie.id], s.local);
      this.stickers.setMatrixAt(i, m);
      if (this.letters) {
        m.multiply(this.letterLift);
        this.letters.setMatrixAt(i, m);
      }
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.stickers.instanceMatrix.needsUpdate = true;
    if (this.letters) this.letters.instanceMatrix.needsUpdate = true;
    this.stage.invalidate();
  }

  // Show a layer turned by `angle` radians without committing it.
  setLayerAngle(axis, layers, angle) {
    const rotation = new Matrix4().makeRotationAxis(AXES[axis], angle);
    const ids = [];
    for (const cubie of this.model.layerCubies(axis, layers)) {
      this.cubieMatrix(cubie, this.cubieMatrices[cubie.id]).premultiply(rotation);
      ids.push(cubie.id);
    }
    this.writeInstances(ids);
  }

  // Animate from `fromAngle` to the move's angle, then commit it.
  async turn(move, { duration = 170, fromAngle = 0 } = {}) {
    const target = move.k * (Math.PI / 2);
    if (this.reducedMotion.matches) duration = Math.min(duration, 60);
    await this.stage.tweens.add({
      duration,
      easing: ease.outCubic,
      update: (t) => this.setLayerAngle(move.axis, move.layers, fromAngle + (target - fromAngle) * t),
    });
    if (move.k !== 0) this.model.apply(move);
    this.sync();
  }

  // Queue moves; returns when this one has played.
  enqueue(move, options = {}) {
    return new Promise((resolve) => {
      this.queue.push({ move, options, resolve });
      if (!this.busy) this.drain();
    });
  }

  async drain() {
    this.busy = true;
    while (this.queue.length) {
      const { move, options, resolve } = this.queue.shift();
      const fast = this.queue.length > 0 && !options.duration;
      const base = move.k === 2 ? 240 : 170;
      await this.turn(move, { ...options, duration: options.duration ?? (fast ? 90 : base) });
      this.onMove?.(move, options);
      resolve();
    }
    this.busy = false;
  }

  cancelQueue() {
    const pending = this.queue.splice(0);
    pending.forEach((p) => p.resolve());
  }

  // Apply moves instantly (restoring state, reduced-motion scramble).
  applyInstant(moves) {
    moves.forEach((m) => this.model.apply(m));
    this.sync();
  }

  // One celebratory hop and spin.
  celebrate() {
    if (this.reducedMotion.matches) return Promise.resolve();
    const start = this.root.rotation.y;
    return this.stage.tweens.add({
      duration: 900,
      easing: ease.inOutCubic,
      update: (t) => {
        this.root.position.y = Math.sin(t * Math.PI) * 0.3;
        this.root.rotation.y = start + t * Math.PI * 2;
        this.shadow.scale.setScalar(1 - Math.sin(t * Math.PI) * 0.12);
        this.stage.invalidate();
      },
    });
  }

  // The cube's local axes as seen from the camera: which local axis (and
  // sign) currently points right, up, and toward the viewer.
  viewBasis() {
    const inv = this.group.quaternion.clone().invert();
    const snap = (v, exclude) => {
      let best = null;
      for (let axis = 0; axis < 3; axis++) {
        if (exclude.includes(axis)) continue;
        const value = [v.x, v.y, v.z][axis];
        if (!best || Math.abs(value) > Math.abs(best.value)) best = { axis, value };
      }
      return { axis: best.axis, sign: Math.sign(best.value) || 1 };
    };
    const front = snap(new Vector3(0, 0, 1).applyQuaternion(inv), []);
    const up = snap(new Vector3(0, 1, 0).applyQuaternion(inv), [front.axis]);
    const rightAxis = 3 - front.axis - up.axis;
    const f = new Vector3().setComponent(front.axis, front.sign);
    const u = new Vector3().setComponent(up.axis, up.sign);
    const r = new Vector3().crossVectors(u, f);
    const right = { axis: rightAxis, sign: Math.sign(r.getComponent(rightAxis)) };
    return { R: right, U: up, F: front };
  }

  // Standard notation read from the current view: F is the face toward you.
  moveFromNotation(token) {
    const match = /^([RLUDFBMESxyz])(2|'|’)?$/.exec(token);
    if (!match) return null;
    const basis = this.viewBasis();
    const letter = match[1];
    const spec = {
      R: ["R", 1, [1]],
      L: ["R", -1, [-1]],
      U: ["U", 1, [1]],
      D: ["U", -1, [-1]],
      F: ["F", 1, [1]],
      B: ["F", -1, [-1]],
      M: ["R", -1, [0]],
      E: ["U", -1, [0]],
      S: ["F", 1, [0]],
      x: ["R", 1, [-1, 0, 1]],
      y: ["U", 1, [-1, 0, 1]],
      z: ["F", 1, [-1, 0, 1]],
    }[letter];
    const [dirName, faceSign, layerSpec] = spec;
    const { axis, sign } = basis[dirName];
    const outward = sign * faceSign;
    const layers = layerSpec.map((l) => l * sign);
    // Clockwise seen from the face = −90° about its outward normal.
    let k = -outward;
    if (match[2] === "2") k = 2;
    else if (match[2]) k = -k;
    const move = createMove(axis, layers, k);
    move.name = letter + (match[2] === "2" ? "2" : match[2] ? "'" : "");
    return move;
  }

  // Name a move (for history) relative to the current view.
  nameFromMove(move) {
    for (const letter of "RLUDFBMESxyz") {
      const candidate = this.moveFromNotation(letter);
      if (candidate.axis !== move.axis || candidate.layers.join() !== move.layers.join()) continue;
      if (move.k === 2) return `${letter}2`;
      return candidate.k === move.k ? letter : `${letter}'`;
    }
    return "?";
  }

  inverse(move) {
    const [inv] = invert([move]);
    inv.name = move.name?.endsWith("2") ? move.name : move.name?.endsWith("'") ? move.name.slice(0, -1) : `${move.name}'`;
    return inv;
  }
}
