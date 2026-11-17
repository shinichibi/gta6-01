// Small maths helpers every system shares: clamping, angles, distances.

/** Keep `value` between `lo` and `hi`. */
export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Move from `a` to `b` by fraction `t` (0..1). */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Squared distance between two points; cheaper than the real thing for comparisons. */
export function distSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Real distance between two points. */
export function dist(ax, ay, bx, by) {
  return Math.sqrt(distSq(ax, ay, bx, by));
}

/** The shortest signed turn from angle `from` to angle `to`, in radians. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from, to, maxStep) {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

/** Does the circle at (x, y) overlap the axis-aligned box? Returns the overlap depth or 0. */
export function circleBoxOverlap(x, y, r, box) {
  const nx = clamp(x, box.x, box.x + box.w);
  const ny = clamp(y, box.y, box.y + box.h);
  const d2 = distSq(x, y, nx, ny);
  if (d2 > r * r) return 0;
  if (d2 > 0.0001) return r - Math.sqrt(d2);
  // Centre inside the box: push out along the shallowest side.
  const left = x - box.x;
  const right = box.x + box.w - x;
  const top = y - box.y;
  const bottom = box.y + box.h - y;
  return Math.min(left, right, top, bottom) + r;
}

/** Push a circle out of a box along the shallowest exit; returns the moved [x, y]. */
export function pushCircleOutOfBox(x, y, r, box) {
  const nx = clamp(x, box.x, box.x + box.w);
  const ny = clamp(y, box.y, box.y + box.h);
  const dx = x - nx;
  const dy = y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    if (d >= r) return [x, y];
    return [nx + (dx / d) * r, ny + (dy / d) * r];
  }
  const left = x - box.x + r;
  const right = box.x + box.w - x + r;
  const top = y - box.y + r;
  const bottom = box.y + box.h - y + r;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return [box.x - r, y];
  if (m === right) return [box.x + box.w + r, y];
  if (m === top) return [x, box.y - r];
  return [x, box.y + box.h + r];
}
