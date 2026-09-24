// Procedural chess pieces: lathe profiles plus a few merged details. Built
// once at startup, so there is no model download. Units: one board square.
import {
  BoxGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const SEGMENTS = 32;

const BASE = [
  [0, 0],
  [0.34, 0],
  [0.35, 0.05],
  [0.31, 0.09],
  [0.26, 0.12],
  [0.23, 0.16],
];

const PROFILES = {
  p: [
    [0, 0],
    [0.3, 0],
    [0.31, 0.05],
    [0.28, 0.09],
    [0.23, 0.12],
    [0.21, 0.15],
    [0.14, 0.22],
    [0.11, 0.34],
    [0.17, 0.37],
    [0.17, 0.39],
    [0.1, 0.41],
    [0.13, 0.45],
    [0.15, 0.5],
    [0.14, 0.56],
    [0.1, 0.6],
    [0.05, 0.62],
    [0, 0.625],
  ],
  r: [
    ...BASE,
    [0.2, 0.3],
    [0.19, 0.52],
    [0.23, 0.56],
    [0.26, 0.58],
    [0.26, 0.7],
    [0.2, 0.7],
    [0.2, 0.66],
    [0, 0.66],
  ],
  b: [
    ...BASE,
    [0.15, 0.28],
    [0.12, 0.47],
    [0.19, 0.5],
    [0.19, 0.53],
    [0.12, 0.55],
    [0.15, 0.61],
    [0.17, 0.69],
    [0.15, 0.77],
    [0.1, 0.83],
    [0.04, 0.87],
    [0.055, 0.9],
    [0.035, 0.93],
    [0, 0.94],
  ],
  q: [
    [0, 0],
    [0.36, 0],
    [0.37, 0.05],
    [0.33, 0.09],
    [0.28, 0.12],
    [0.25, 0.16],
    [0.17, 0.3],
    [0.13, 0.58],
    [0.2, 0.62],
    [0.2, 0.65],
    [0.14, 0.67],
    [0.17, 0.76],
    [0.22, 0.86],
    [0.18, 0.88],
    [0.1, 0.9],
    [0.07, 0.94],
    [0, 0.95],
  ],
  k: [
    [0, 0],
    [0.37, 0],
    [0.38, 0.05],
    [0.34, 0.09],
    [0.29, 0.12],
    [0.26, 0.16],
    [0.18, 0.3],
    [0.14, 0.64],
    [0.21, 0.68],
    [0.21, 0.71],
    [0.15, 0.73],
    [0.18, 0.82],
    [0.21, 0.9],
    [0.17, 0.92],
    [0.1, 0.94],
    [0, 0.94],
  ],
  n: [
    ...BASE,
    [0.2, 0.22],
    [0, 0.22],
  ],
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

function knightHead() {
  // Facing +x; extruded along z and centred.
  const points = [
    [-0.18, 0.18],
    [0.2, 0.18],
    [0.2, 0.3],
    [0.12, 0.42],
    [0.24, 0.52],
    [0.29, 0.6],
    [0.23, 0.68],
    [0.07, 0.79],
    [0.03, 0.88],
    [-0.05, 0.8],
    [-0.14, 0.72],
    [-0.2, 0.54],
    [-0.22, 0.34],
  ];
  const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)));
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 4,
  });
  return geometry.translate(0, 0, -0.11);
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
  const merlons = [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    return box(0.1, 0.09, 0.13, 0.2, 0.745, 0).rotateY(a);
  });
  geometries.r = merge([lathe(PROFILES.r), ...merlons]);
  geometries.b = merge([lathe(PROFILES.b)]);
  const crown = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return new SphereGeometry(0.035, 8, 6).translate(Math.cos(a) * 0.2, 0.875, Math.sin(a) * 0.2);
  });
  geometries.q = merge([lathe(PROFILES.q), new SphereGeometry(0.06, 12, 8).translate(0, 0.99, 0), ...crown]);
  geometries.k = merge([lathe(PROFILES.k), box(0.07, 0.24, 0.07, 0, 1.05, 0), box(0.2, 0.07, 0.07, 0, 1.08, 0)]);
  geometries.n = merge([lathe(PROFILES.n), knightHead()]);
  return geometries;
}
