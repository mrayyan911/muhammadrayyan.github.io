// Procedural Staunton pieces: lathe profiles plus a few merged details. Built
// once at startup, so there is no model download. Units: one board square.
// Each piece gets its own height and one bold signature (crenellations,
// mitre, coronet, cross, horse head) so they read apart at a glance.
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const SEGMENTS = 40;

// Stepped foot shared by every piece, scaled by its radius.
function foot(r) {
  return [
    [0, 0],
    [r, 0],
    [r + 0.012, 0.025],
    [r, 0.055],
    [r - 0.035, 0.075],
    [r - 0.04, 0.095],
    [r - 0.075, 0.115],
    [r - 0.085, 0.14],
  ];
}

// Collar ring between stem and head.
function collar(r, y) {
  return [
    [r - 0.02, y],
    [r, y + 0.012],
    [r, y + 0.03],
    [r - 0.02, y + 0.042],
  ];
}

// Quarter-to-half arcs for balls and domes, bottom to top.
function arc(cy, radius, from = -Math.PI / 2, to = Math.PI / 2, steps = 10) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    points.push([Math.max(0, Math.cos(a) * radius), cy + Math.sin(a) * radius]);
  }
  return points;
}

const PROFILES = {
  p: [
    ...foot(0.3),
    [0.16, 0.2],
    [0.115, 0.33],
    ...collar(0.19, 0.35),
    [0.1, 0.405],
    ...arc(0.53, 0.14, -1.05),
  ],
  r: [
    ...foot(0.33),
    [0.225, 0.2],
    [0.2, 0.52],
    [0.22, 0.56],
    [0.27, 0.6],
    [0.28, 0.63],
    [0.28, 0.72],
    [0.18, 0.72],
    [0.18, 0.69],
    [0, 0.69],
  ],
  b: [
    ...foot(0.32),
    [0.17, 0.22],
    [0.12, 0.48],
    ...collar(0.2, 0.5),
    [0.11, 0.56],
    [0.14, 0.61],
    [0.172, 0.68],
    [0.172, 0.74],
    [0.15, 0.8],
    [0.11, 0.86],
    [0.06, 0.9],
    [0.035, 0.915],
    ...arc(0.955, 0.05, -0.9),
  ],
  q: [
    ...foot(0.36),
    [0.2, 0.24],
    [0.14, 0.6],
    ...collar(0.23, 0.63),
    [0.13, 0.69],
    [0.16, 0.78],
    [0.22, 0.9],
    [0.26, 0.95],
    [0.24, 0.97],
    [0.16, 0.975],
    ...arc(0.975, 0.14, 0, Math.PI / 2, 6),
  ],
  k: [
    ...foot(0.37),
    [0.21, 0.24],
    [0.15, 0.66],
    ...collar(0.24, 0.69),
    [0.14, 0.75],
    [0.17, 0.86],
    [0.235, 1.0],
    [0.235, 1.03],
    [0.16, 1.04],
    ...arc(1.04, 0.12, 0, Math.PI / 2, 6),
  ],
  n: [...foot(0.33), [0.23, 0.2], [0.23, 0.24], [0, 0.24]],
};

function lathe(points) {
  return new LatheGeometry(
    points.map(([r, y]) => new Vector2(r, y)),
    SEGMENTS,
  );
}

function box(w, h, d, x, y, z) {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

// Horse head in profile, muzzle toward +x, extruded along z and centred.
function knightHead() {
  const points = [
    [-0.21, 0.22],
    [0.2, 0.22],
    [0.23, 0.33],
    [0.14, 0.47],
    [0.17, 0.55],
    [0.33, 0.6],
    [0.38, 0.66],
    [0.36, 0.72],
    [0.26, 0.77],
    [0.15, 0.86],
    [0.13, 0.99],
    [0.07, 0.91],
    [0.02, 0.98],
    [-0.05, 0.89],
    [-0.15, 0.8],
    [-0.21, 0.66],
    [-0.25, 0.46],
  ];
  const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)));
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.035,
    bevelSegments: 4,
    curveSegments: 1,
  });
  return geometry.translate(0, 0, -0.1);
}

function merge(parts) {
  const geometry = mergeGeometries(
    parts.map((g) => {
      const flat = g.index ? g.toNonIndexed() : g;
      flat.deleteAttribute("uv");
      return flat;
    }),
  );
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildPieceGeometries() {
  const geometries = {};
  geometries.p = merge([lathe(PROFILES.p)]);

  // Six square merlons with clear gaps.
  const merlons = Array.from({ length: 6 }, (_, i) =>
    box(0.1, 0.1, 0.13, 0.215, 0.77, 0).rotateY((i * Math.PI) / 3),
  );
  geometries.r = merge([lathe(PROFILES.r), ...merlons]);

  geometries.b = merge([lathe(PROFILES.b)]);

  // Coronet of points around the crown, with a ball on top.
  const points = Array.from({ length: 9 }, (_, i) => {
    const a = (i * Math.PI * 2) / 9;
    return new ConeGeometry(0.045, 0.12, 8).translate(Math.cos(a) * 0.225, 1.0, Math.sin(a) * 0.225);
  });
  geometries.q = merge([
    lathe(PROFILES.q),
    ...points,
    new SphereGeometry(0.075, 16, 10).translate(0, 1.18, 0),
  ]);

  // A tall, bold cross.
  geometries.k = merge([
    lathe(PROFILES.k),
    new CylinderGeometry(0.05, 0.07, 0.06, 16).translate(0, 1.18, 0),
    box(0.085, 0.3, 0.085, 0, 1.34, 0),
    box(0.26, 0.085, 0.085, 0, 1.37, 0),
  ]);

  geometries.n = merge([lathe(PROFILES.n), knightHead()]);
  return geometries;
}
