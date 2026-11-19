// A small seeded random generator (mulberry32) so the city, traffic and staged
// screenshot scenes come out the same every time a seed is given.

/** Create a generator from a 32-bit seed. */
export function createRng(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [lo, hi). */
    range(lo, hi) {
      return lo + next() * (hi - lo);
    },
    /** Integer in [lo, hi], both ends included. */
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    /** One item of a list. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** True with probability `p`. */
    chance(p) {
      return next() < p;
    },
    /** A random heading, in radians. */
    angle() {
      return next() * Math.PI * 2;
    },
    /** -1 or 1, coin-flip odds: which way along a shore, which side of a pier. */
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
  };
}
