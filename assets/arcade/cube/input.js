// Pointer and keyboard control for the cube. Dragging a sticker turns its
// layer live; dragging the background rotates the whole cube.
import { Matrix4, Plane, Quaternion, Raycaster, Vector2, Vector3 } from "three";
import { createMove } from "./model.js";
import { DEFAULT_ORIENTATION } from "./view.js";

const QUARTER = Math.PI / 2;
const TURN_THRESHOLD = 0.12;
const ORBIT_SPEED = 0.008;

export class CubeInput {
  constructor(canvas, stage, view, { canTurn, onTurn, onOrbit }) {
    this.canvas = canvas;
    this.stage = stage;
    this.view = view;
    this.canTurn = canTurn;
    this.onTurn = onTurn;
    this.onOrbit = onOrbit;
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.drag = null;
    this.spin = new Vector2();
    this.enabled = true;

    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", (e) => this.up(e, true));
    canvas.addEventListener("dblclick", (e) => {
      if (!this.hit(e)) this.resetView();
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  ray(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);
    // Work in the cube's local frame, where every face is axis aligned.
    const inverse = new Matrix4().copy(this.view.group.matrixWorld).invert();
    return this.raycaster.ray.clone().applyMatrix4(inverse);
  }

  hit(e) {
    this.view.group.updateMatrixWorld();
    this.ray(e);
    return this.raycaster.intersectObject(this.view.bodies, false)[0] ?? null;
  }

  down(e) {
    if (!this.enabled || (e.pointerType === "mouse" && e.button !== 0) || this.drag) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events have no capturable pointer.
    }
    this.spin.set(0, 0);
    const hit = this.hit(e);
    const start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    if (hit && this.canTurn() && !this.view.busy) {
      const local = this.view.group.worldToLocal(hit.point.clone());
      const coords = [local.x, local.y, local.z];
      let axis = 0;
      for (let i = 1; i < 3; i++) if (Math.abs(coords[i]) > Math.abs(coords[axis])) axis = i;
      const normal = new Vector3().setComponent(axis, Math.sign(coords[axis]));
      this.drag = {
        ...start,
        mode: "pending",
        cubie: this.view.model.cubies[hit.instanceId],
        normal,
        normalAxis: axis,
        plane: new Plane().setFromNormalAndCoplanarPoint(normal, local),
        origin: local,
      };
    } else {
      this.drag = { ...start, mode: "orbit", lastX: e.clientX, lastY: e.clientY };
    }
  }

  planePoint(e) {
    const ray = this.ray(e);
    return ray.intersectPlane(this.drag.plane, new Vector3());
  }

  move(e) {
    const drag = this.drag;
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.mode === "orbit") {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      this.rotateBy(dx, dy);
      this.spin.set(dx, dy);
      drag.lastT = performance.now();
      return;
    }
    const point = this.planePoint(e);
    if (!point) return;
    const d = point.sub(drag.origin);
    const v = [d.x, d.y, d.z];
    if (drag.mode === "pending") {
      const tangents = [0, 1, 2].filter((a) => a !== drag.normalAxis);
      const t = Math.abs(v[tangents[0]]) >= Math.abs(v[tangents[1]]) ? tangents[0] : tangents[1];
      if (Math.abs(v[t]) < TURN_THRESHOLD) return;
      const axis = 3 - drag.normalAxis - t;
      const e_axis = new Vector3().setComponent(axis, 1);
      const e_t = new Vector3().setComponent(t, 1);
      // Direction of motion for +angle about the axis, at the touched face.
      const c = new Vector3().crossVectors(e_axis, drag.normal).dot(e_t);
      Object.assign(drag, {
        mode: "turning",
        axis,
        tangent: t,
        factor: c,
        layers: [drag.cubie.pos[axis]],
        angle: 0,
        samples: [],
      });
    }
    // The sticker tracks the finger: arc length ≈ radius × angle.
    drag.angle = Math.max(-Math.PI, Math.min(Math.PI, (drag.factor * v[drag.tangent]) / 1.5));
    drag.samples.push({ t: performance.now(), a: drag.angle });
    if (drag.samples.length > 5) drag.samples.shift();
    this.view.setLayerAngle(drag.axis, drag.layers, drag.angle);
  }

  up(e, cancelled = false) {
    const drag = this.drag;
    if (!drag || drag.id !== e.pointerId) return;
    this.drag = null;
    if (drag.mode === "orbit") {
      const idle = performance.now() - (drag.lastT ?? 0) > 80;
      if (!idle && !cancelled) this.coast();
      return;
    }
    if (drag.mode !== "turning") return;
    let k = Math.round(drag.angle / QUARTER);
    const [first, last] = [drag.samples[0], drag.samples[drag.samples.length - 1]];
    const velocity = first && last && last.t > first.t ? ((last.a - first.a) / (last.t - first.t)) * 1000 : 0;
    if (!cancelled && Math.abs(velocity) > 0.9 && Math.sign(velocity) === Math.sign(drag.angle)) {
      k = Math.sign(drag.angle) * Math.ceil(Math.abs(drag.angle) / QUARTER - 0.05);
    }
    if (cancelled) k = 0;
    k = Math.max(-2, Math.min(2, k));
    const move = createMove(drag.axis, drag.layers, k);
    const duration = 60 + 120 * Math.min(1, Math.abs(k * QUARTER - drag.angle) / QUARTER);
    if (k === 0) {
      this.view.turn({ ...move, k: 0 }, { fromAngle: drag.angle, duration });
      return;
    }
    // Keep ±2 turning the way the finger went.
    const animated = { ...move, k: k === 2 || k === -2 ? k : move.k };
    this.view.busy = true;
    this.view
      .turn(animated, { fromAngle: drag.angle, duration })
      .then(() => {
        this.view.busy = false;
        this.onTurn(move);
        if (this.view.queue.length) this.view.drain();
      });
  }

  cancelDrag() {
    if (this.drag?.mode === "turning") {
      const { axis, layers, angle } = this.drag;
      this.drag = null;
      this.view.turn(createMove(axis, layers, 0), { fromAngle: angle, duration: 150 });
      return true;
    }
    this.drag = null;
    return false;
  }

  rotateBy(dx, dy) {
    const camera = this.stage.camera;
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const q = new Quaternion()
      .setFromAxisAngle(up, dx * ORBIT_SPEED)
      .multiply(new Quaternion().setFromAxisAngle(right, dy * ORBIT_SPEED));
    this.view.group.quaternion.premultiply(q).normalize();
    this.stage.invalidate();
    this.onOrbit?.();
  }

  coast() {
    const spin = this.spin.clone();
    this.stage.animate(() => {
      if (this.drag) return false;
      spin.multiplyScalar(0.92);
      if (spin.length() < 0.05) return false;
      this.rotateBy(spin.x, spin.y);
      return true;
    });
  }

  resetView(duration = 350) {
    const from = this.view.group.quaternion.clone();
    return this.stage.tweens.add({
      duration: this.view.reducedMotion.matches ? 0 : duration,
      update: (t) => {
        this.view.group.quaternion.slerpQuaternions(from, DEFAULT_ORIENTATION, t);
        this.stage.invalidate();
      },
    });
  }
}
