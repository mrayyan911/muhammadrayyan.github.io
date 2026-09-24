// Board, pieces, and markers. Pieces are six instanced meshes (one per type)
// coloured per instance; squares are one instanced mesh.
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { blobTexture } from "../core/stage.js";
import { ease } from "../core/tween.js";
import { buildPieceGeometries } from "./pieces.js";

const TYPES = ["p", "n", "b", "r", "q", "k"];
const CAPACITY = { p: 16, n: 20, b: 20, r: 20, q: 18, k: 2 };
const COLORS = {
  light: new Color(0xdcd1ba),
  dark: new Color(0xab9d80),
  last: new Color(0xe3be45),
  selected: new Color(0xb93422),
  check: new Color(0xb93422),
  hover: new Color(0xb93422),
  white: new Color(0xebe4d4),
  black: new Color(0x2a2924),
};
const FILES = "abcdefgh";

export function squareToXZ(square) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  return [file - 3.5, 3.5 - rank];
}

export function xzToSquare(x, z) {
  const file = Math.floor(x + 4);
  const rank = Math.floor(4 - z);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return FILES[file] + (rank + 1);
}

function coordinatesTexture(flipped) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#d3cbbb";
  ctx.fillRect(0, 0, size, size);
  const unit = size / 9;
  ctx.fillStyle = "#6a6352";
  ctx.font = `500 ${unit * 0.24}px "DM Mono", Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = (label, x, y) => {
    ctx.save();
    ctx.translate(x, y);
    if (flipped) ctx.rotate(Math.PI);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  };
  for (let i = 0; i < 8; i++) {
    const c = (i + 1) * unit;
    text(FILES[i], c, size - unit * 0.25);
    text(FILES[i], c, unit * 0.25);
    text(String(8 - i), unit * 0.25, c);
    text(String(8 - i), size - unit * 0.25, c);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export class ChessView {
  constructor(stage, { quality, reducedMotion, interactive = true, compact = false }) {
    this.compact = compact;
    this.stage = stage;
    this.reducedMotion = reducedMotion;
    this.pieces = new Map(); // id → piece state
    this.nextId = 0;
    this.highlights = {};
    this.flipped = false;
    this.top = false;
    const scene = stage.scene;
    const Material = quality.low ? MeshLambertMaterial : MeshStandardMaterial;

    // Board frame with baked coordinates on top.
    this.frameTop = new MeshBasicMaterial({ map: coordinatesTexture(false) });
    const side = new Material({ color: 0xc4bba8 });
    const frame = new Mesh(new BoxGeometry(9, 0.3, 9), [side, side, this.frameTop, side, side, side]);
    frame.position.y = -0.17;
    scene.add(frame);

    this.squares = new InstancedMesh(new BoxGeometry(1, 0.1, 1), new Material({ color: 0xffffff }), 64);
    const m = new Matrix4();
    for (let i = 0; i < 64; i++) {
      const square = FILES[i % 8] + (Math.floor(i / 8) + 1);
      const [x, z] = squareToXZ(square);
      this.squares.setMatrixAt(i, m.makeTranslation(x, -0.05, z));
    }
    if (!quality.low) this.squares.material.roughness = 0.7;
    scene.add(this.squares);

    // Pieces.
    const geometries = buildPieceGeometries();
    const pieceMaterial = new Material({ color: 0xffffff });
    if (!quality.low) {
      pieceMaterial.roughness = 0.36;
      // Less ambient fill on the pieces only, so the key light models them.
      pieceMaterial.envMap = scene.environment;
      pieceMaterial.envMapIntensity = 0.4;
    }
    // A low raking key light gives the pieces a lit and a shaded side, so
    // ivory pieces separate from the light squares. Low, so the flat board
    // catches little of it.
    const key = new DirectionalLight(0xfff3e2, quality.low ? 1 : 2.2);
    key.position.set(-6, 3.5, 4);
    scene.add(key);
    this.meshes = {};
    for (const type of TYPES) {
      const mesh = new InstancedMesh(geometries[type], pieceMaterial, CAPACITY[type]);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.meshes[type] = mesh;
      scene.add(mesh);
    }
    this.shadows = new InstancedMesh(
      new PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map: blobTexture(64, 0.6), transparent: true, depthWrite: false }),
      40,
    );
    this.shadows.count = 0;
    this.shadows.frustumCulled = false;
    scene.add(this.shadows);

    // Markers: legal-move dots, capture rings, keyboard cursor.
    const markerMaterial = new MeshBasicMaterial({ color: 0xb93422, transparent: true, opacity: 0.85, depthWrite: false });
    this.dots = new InstancedMesh(new CircleGeometry(0.14, 20).rotateX(-Math.PI / 2), markerMaterial, 32);
    this.rings = new InstancedMesh(new RingGeometry(0.36, 0.44, 32).rotateX(-Math.PI / 2), markerMaterial, 16);
    this.dots.count = this.rings.count = 0;
    this.dots.frustumCulled = this.rings.frustumCulled = false;
    this.cursor = new Mesh(
      new RingGeometry(0.62, 0.68, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: 0x25251f, depthWrite: false, transparent: true }),
    );
    this.cursor.visible = false;
    scene.add(this.dots, this.rings, this.cursor);

    this.controls = null;
    if (interactive) {
      this.controls = new OrbitControls(stage.camera, stage.renderer.domElement);
      Object.assign(this.controls, {
        enablePan: false,
        enableDamping: true,
        dampingFactor: 0.08,
        rotateSpeed: 0.6,
        minPolarAngle: 0.001,
        maxPolarAngle: 1.15,
        minDistance: 9,
        maxDistance: 26,
      });
      this.controls.addEventListener("change", () => stage.invalidate());
      // Damping needs frames after release.
      this.controls.addEventListener("end", () => {
        let frames = 40;
        stage.animate(() => {
          this.controls.update();
          return --frames > 0;
        });
      });
    }
    this.setHighlights({});
    this.placeCamera(false);
  }

  // Camera angle: steeper on narrow portrait screens so taps land accurately.
  cameraSpherical() {
    const aspect = this.stage.width / this.stage.height;
    const narrow = aspect < 1.25;
    // Steeper on narrow stages so taps land accurately.
    const polar = this.top ? 0.001 : narrow ? 0.5 : 0.72;
    // Wide stages fit the board plus the capture trays; narrow ones fit the
    // board and let the trays run off the sides.
    const fit = this.compact ? 14.2 : this.top ? 13.5 : 15.5;
    const distance = narrow && !this.compact ? (this.top ? 14 : 16.6) / Math.max(aspect, 0.55) : fit;
    const azimuth = this.flipped ? Math.PI : 0;
    return { polar, distance, azimuth };
  }

  positionFor({ polar, distance, azimuth }) {
    return new Vector3(
      distance * Math.sin(polar) * Math.sin(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.cos(azimuth),
    );
  }

  placeCamera(animate = true) {
    const camera = this.stage.camera;
    const target = this.positionFor(this.cameraSpherical());
    const finish = () => {
      camera.lookAt(0, 0, 0);
      this.controls?.update();
      this.stage.invalidate();
    };
    if (!animate || this.reducedMotion.matches) {
      camera.position.copy(target);
      if (this.top) camera.up.set(0, 0, this.flipped ? 1 : -1);
      else camera.up.set(0, 1, 0);
      finish();
      return Promise.resolve();
    }
    // Interpolate spherically so the flip swings around the board.
    const from = camera.position.clone();
    const fromS = { r: from.length(), polar: Math.acos(from.y / from.length()), az: Math.atan2(from.x, from.z) };
    const to = this.cameraSpherical();
    let dAz = to.azimuth - fromS.az;
    while (dAz > Math.PI) dAz -= Math.PI * 2;
    while (dAz < -Math.PI) dAz += Math.PI * 2;
    if (Math.abs(Math.abs(dAz) - Math.PI) < 0.01) dAz = Math.PI;
    if (this.controls) this.controls.enabled = false;
    return this.stage.tweens
      .add({
        duration: Math.abs(dAz) > 1 ? 600 : 400,
        easing: ease.inOutCubic,
        update: (t) => {
          const s = {
            distance: fromS.r + (to.distance - fromS.r) * t,
            polar: Math.max(0.001, fromS.polar + (to.polar - fromS.polar) * t),
            azimuth: fromS.az + dAz * t,
          };
          camera.position.copy(this.positionFor(s));
          camera.up.set(0, 1, 0);
          camera.lookAt(0, 0, 0);
          this.stage.invalidate();
        },
      })
      .then(() => {
        if (this.controls) this.controls.enabled = true;
        finish();
      });
  }

  setFlipped(flipped, animate = true) {
    if (this.flipped === flipped) return Promise.resolve();
    this.flipped = flipped;
    this.refreshCoordinates();
    return this.placeCamera(animate);
  }

  // Coordinates read upright from the player's side; redrawn after fonts load.
  refreshCoordinates() {
    this.frameTop.map.dispose();
    this.frameTop.map = coordinatesTexture(this.flipped);
    this.stage.invalidate();
  }

  setTopView(on) {
    this.top = on;
    return this.placeCamera(true);
  }

  onResize() {
    if (!this.controls?.enabled) return;
    this.placeCamera(false);
  }

  // Replace all pieces from a chess.js board() array, no animation.
  setPosition(board) {
    this.pieces.clear();
    for (const row of board) {
      for (const cell of row) {
        if (!cell) continue;
        this.addPiece(cell.type, cell.color, cell.square);
      }
    }
    this.writePieces();
  }

  addPiece(type, color, square) {
    const [x, z] = squareToXZ(square);
    const piece = { id: this.nextId++, type, color, square, pos: new Vector3(x, 0, z), lift: 0, scale: 1, spin: 0 };
    this.pieces.set(piece.id, piece);
    return piece;
  }

  pieceAt(square) {
    for (const piece of this.pieces.values()) if (piece.square === square && !piece.captured) return piece;
    return null;
  }

  writePieces() {
    const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const up = new Vector3(0, 1, 0);
    let shadowCount = 0;
    for (const piece of this.pieces.values()) {
      const mesh = this.meshes[piece.type];
      const i = counts[piece.type]++;
      // Knights look across the board toward the opponent, turned mostly
      // side-on so the horse's profile faces the camera.
      const facing = piece.type === "n" ? (piece.color === "w" ? 0.45 : Math.PI + 0.45) : 0;
      q.setFromAxisAngle(up, facing + piece.spin);
      p.set(piece.pos.x, piece.pos.y + piece.lift, piece.pos.z);
      s.setScalar(piece.scale);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.setColorAt(i, piece.color === "w" ? COLORS.white : COLORS.black);
      if (piece.scale > 0.05 && !piece.inTray) {
        const spread = 1 + piece.lift * 0.6;
        this.shadows.setMatrixAt(
          shadowCount++,
          m.compose(new Vector3(piece.pos.x, 0.004, piece.pos.z), new Quaternion(), s.setScalar(spread * piece.scale)),
        );
      }
    }
    for (const type of TYPES) {
      const mesh = this.meshes[type];
      mesh.count = counts[type];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.shadows.count = shadowCount;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.stage.invalidate();
  }

  // Square tints and markers.
  setHighlights(h) {
    this.highlights = { ...this.highlights, ...h };
    const { selected, lastMove = [], check, hover, targets = [], cursor } = this.highlights;
    const c = new Color();
    for (let i = 0; i < 64; i++) {
      const square = FILES[i % 8] + (Math.floor(i / 8) + 1);
      const isLight = (i % 8) % 2 !== Math.floor(i / 8) % 2;
      c.copy(isLight ? COLORS.light : COLORS.dark);
      if (lastMove.includes(square)) c.lerp(COLORS.last, 0.45);
      if (square === selected) c.lerp(COLORS.selected, 0.35);
      if (square === hover) c.lerp(COLORS.hover, 0.22);
      if (square === check) c.lerp(COLORS.check, 0.7);
      this.squares.setColorAt(i, c);
    }
    this.squares.instanceColor.needsUpdate = true;

    const m = new Matrix4();
    let dots = 0;
    let rings = 0;
    for (const target of targets) {
      const [x, z] = squareToXZ(target.square);
      m.makeTranslation(x, 0.006, z);
      if (target.capture) this.rings.setMatrixAt(rings++, m);
      else this.dots.setMatrixAt(dots++, m);
    }
    this.dots.count = dots;
    this.rings.count = rings;
    this.dots.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;

    this.cursor.visible = !!cursor;
    if (cursor) {
      const [x, z] = squareToXZ(cursor);
      this.cursor.position.set(x, 0.008, z);
    }
    this.stage.invalidate();
  }

  liftPiece(piece, height, duration = 140) {
    const from = piece.lift;
    return this.stage.tweens.add({
      duration: this.reducedMotion.matches ? 0 : duration,
      easing: ease.outCubic,
      update: (t) => {
        piece.lift = from + (height - from) * t;
        this.writePieces();
      },
    });
  }

  slide(piece, square, { duration = 260, hop = 0.08, delay = 0 } = {}) {
    const [x, z] = squareToXZ(square);
    const from = piece.pos.clone();
    const fromLift = piece.lift;
    const to = new Vector3(x, 0, z);
    piece.square = square;
    if (this.reducedMotion.matches) duration = Math.min(duration, 80);
    return this.stage.tweens.add({
      duration,
      delay,
      easing: ease.inOutCubic,
      update: (t) => {
        piece.pos.lerpVectors(from, to, t);
        piece.lift = fromLift * (1 - t) + (this.reducedMotion.matches ? 0 : Math.sin(t * Math.PI) * hop);
        this.writePieces();
      },
    });
  }

  // Slide a captured piece off to the side of the board.
  capture(piece, slot, delay = 120, instant = false) {
    piece.captured = true;
    piece.square = null;
    const byWhite = piece.color === "b";
    const col = slot % 8;
    const row = Math.floor(slot / 8);
    // Each side's captures line up beside the board, on its own right.
    const x = byWhite ? 5.25 + row * 0.5 : -5.25 - row * 0.5;
    const z = byWhite ? 3.5 - col * 0.62 : -3.5 + col * 0.62;
    const from = piece.pos.clone();
    const to = new Vector3(x, -0.02, z);
    return this.stage.tweens.add({
      duration: instant || this.reducedMotion.matches ? 0 : 300,
      delay: instant ? 0 : delay,
      easing: ease.inOutCubic,
      update: (t) => {
        piece.pos.lerpVectors(from, to, t);
        piece.scale = 1 - 0.45 * t;
        piece.lift = Math.sin(t * Math.PI) * 0.3;
        piece.inTray = t > 0.9;
        this.writePieces();
      },
    });
  }

  promote(piece, type) {
    const shrink = this.stage.tweens.add({
      duration: this.reducedMotion.matches ? 0 : 180,
      update: (t) => {
        piece.scale = 1 - t;
        this.writePieces();
      },
    });
    return shrink.then(() => {
      piece.type = type;
      return this.stage.tweens.add({
        duration: this.reducedMotion.matches ? 0 : 180,
        easing: ease.outBack,
        update: (t) => {
          piece.scale = t;
          this.writePieces();
        },
      });
    });
  }

  flash(square) {
    if (this.reducedMotion.matches) return Promise.resolve();
    const base = this.highlights.check;
    return this.stage.tweens.add({
      duration: 400,
      easing: ease.linear,
      update: (t) => {
        const on = Math.floor(t * 4) % 2 === 0;
        this.setHighlights({ check: on ? square : base === square ? null : base });
        if (t >= 1) this.setHighlights({ check: square });
      },
    });
  }

  // Animate a verbose chess.js move (already played on the game).
  async animateMove(move, captureSlot) {
    const piece = this.pieceAt(move.from);
    if (!piece) return;
    const jobs = [];
    const capturedSquare = move.flags.includes("e") ? move.to[0] + move.from[1] : move.captured ? move.to : null;
    if (capturedSquare) {
      const victim = this.pieceAt(capturedSquare);
      if (victim) jobs.push(this.capture(victim, captureSlot));
    }
    const knight = piece.type === "n";
    jobs.push(this.slide(piece, move.to, knight ? { duration: 320, hop: 0.6 } : {}));
    if (move.flags.includes("k") || move.flags.includes("q")) {
      const rank = move.from[1];
      const [rookFrom, rookTo] = move.flags.includes("k") ? ["h" + rank, "f" + rank] : ["a" + rank, "d" + rank];
      const rook = this.pieceAt(rookFrom);
      if (rook) jobs.push(this.slide(rook, rookTo, { duration: 300, hop: 0.12 }));
    }
    await Promise.all(jobs);
    if (move.promotion) await this.promote(piece, move.promotion);
  }
}
