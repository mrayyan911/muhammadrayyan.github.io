// Pointer input for the board. Picking maps a ray onto the board plane, so
// no per-mesh raycasting is needed. A drag that starts on one of your pieces
// moves it; any other drag orbits the camera.
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { xzToSquare } from "./view.js";

const DRAG_THRESHOLD = 6;

export class ChessInput {
  constructor(canvas, stage, view, handlers) {
    this.canvas = canvas;
    this.stage = stage;
    this.view = view;
    this.handlers = handlers;
    this.raycaster = new Raycaster();
    this.plane = new Plane(new Vector3(0, 1, 0), -0.06);
    this.gesture = null;
    // Capture phase runs before OrbitControls' own listener.
    canvas.addEventListener("pointerdown", (e) => this.down(e), { capture: true });
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", (e) => this.up(e, true));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  point(e, height = 0.06) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    this.plane.constant = -height;
    return this.raycaster.ray.intersectPlane(this.plane, new Vector3());
  }

  squareAt(e) {
    const p = this.point(e);
    return p ? xzToSquare(p.x, p.z) : null;
  }

  down(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (this.gesture) return;
    const square = this.squareAt(e);
    const own = square && this.handlers.canPick(square);
    const target = square && this.handlers.isTarget(square);
    this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, square, own, dragging: false };
    if (own || target) {
      // Claim the gesture so the camera doesn't orbit.
      if (this.view.controls) this.view.controls.enabled = false;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic events have no capturable pointer.
      }
    }
  }

  move(e) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
    if (!g.dragging && g.own && moved > DRAG_THRESHOLD) {
      g.dragging = true;
      g.piece = this.view.pieceAt(g.square);
      this.handlers.onDragStart(g.square);
    }
    if (g.dragging && g.piece) {
      const p = this.point(e, 0.45);
      if (!p) return;
      p.x = Math.max(-4.4, Math.min(4.4, p.x));
      p.z = Math.max(-4.4, Math.min(4.4, p.z));
      g.piece.pos.set(p.x, 0, p.z);
      g.piece.lift = 0.45;
      this.view.writePieces();
      const hover = xzToSquare(p.x, p.z);
      if (hover !== g.hover) {
        g.hover = hover;
        this.view.setHighlights({ hover: hover && this.handlers.isTarget(hover) ? hover : null });
      }
    }
    if (moved > DRAG_THRESHOLD) g.moved = true;
  }

  up(e, cancelled = false) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId) return;
    this.gesture = null;
    if (this.view.controls) this.view.controls.enabled = true;
    this.view.setHighlights({ hover: null });
    if (g.dragging) {
      this.handlers.onDrop(g.square, cancelled ? null : g.hover, g.piece);
      return;
    }
    if (!cancelled && !g.moved) this.handlers.onSquare(this.squareAt(e) ?? g.square);
  }
}
