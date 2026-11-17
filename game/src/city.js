// Port Azura itself: the road grid, the buildings on every block, the named places the
// story visits, the props on the pavements, and the parking spots where cars wait.
// Generation is seeded, so the city is the same on every visit.

import { PALETTE, ROADS, ROAD_HALF, WORLD } from './config.js';
import { clamp } from './util.js';

/** What a block is used for, keyed "column,row" on the 7 by 7 grid between avenues. */
const BLOCK_USE = {
  '0,0': 'airfield',
  '1,0': 'airfield',
  '2,2': 'park',
  '4,1': 'park',
  '0,6': 'marina',
  '3,6': 'docks',
  '4,6': 'docks',
  '5,5': 'lot',
  '6,3': 'lot',
};

/** Named buildings on otherwise ordinary blocks, keyed the same way. */
const BLOCK_LANDMARK = {
  '1,5': { name: 'St. Coral Hospital', sign: 'hospital', floors: 6 },
  '5,1': { name: "Vera's Garage", sign: 'garage', floors: 2 },
  '3,3': { name: 'Banco del Mar', sign: 'bank', floors: 8 },
  '5,2': { name: 'Palms Hotel', sign: 'hotel', floors: 9 },
  '4,4': { name: 'Azura Police HQ', sign: 'police', floors: 5 },
  '2,4': { name: 'Coral Flats', sign: 'home', floors: 7 },
};

/** The rectangle of one block: the land between two avenues each way. */
export function blockRect(col, row) {
  const x = ROADS[col] + ROAD_HALF;
  const y = ROADS[row] + ROAD_HALF;
  return { x, y, w: ROADS[col + 1] - ROADS[col] - ROAD_HALF * 2, h: ROADS[row + 1] - ROADS[row] - ROAD_HALF * 2 };
}

/** Is this point on a road (either axis within half a road of a centre line)? */
export function isOnRoad(x, y) {
  for (const c of ROADS) {
    if (Math.abs(x - c) <= ROAD_HALF || Math.abs(y - c) <= ROAD_HALF) return true;
  }
  return false;
}

/** Build the whole city from a seeded generator. */
export function createCity(rng) {
  const buildings = [];
  const props = [];
  const blocks = [];
  const parkedSpots = [];

  function addBuilding(x, y, w, h, options = {}) {
    const wall = options.wall ?? rng.pick(PALETTE.buildingWalls);
    const roof = options.roof ?? rng.pick(PALETTE.buildingRoofs);
    const floors = options.floors ?? rng.int(2, 9);
    const building = { x, y, w, h, wall, roof, floors, name: options.name ?? null, sign: options.sign ?? null, roofProps: [] };
    // Roof clutter: air-conditioning boxes the renderer draws as little grey slabs.
    const clutter = Math.floor((w * h) / 9000);
    for (let i = 0; i < clutter; i += 1) {
      building.roofProps.push({ dx: rng.range(8, Math.max(9, w - 26)), dy: rng.range(8, Math.max(9, h - 26)), s: rng.range(10, 20) });
    }
    buildings.push(building);
    return building;
  }

  function addProp(x, y, kind) {
    props.push({ x, y, kind });
  }

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const rect = blockRect(col, row);
      const use = BLOCK_USE[`${col},${row}`] ?? 'city';
      blocks.push({ ...rect, use });
      const inset = 20;
      const ix = rect.x + inset;
      const iy = rect.y + inset;
      const iw = rect.w - inset * 2;
      const ih = rect.h - inset * 2;

      if (use === 'park') {
        for (let i = 0; i < 16; i += 1) addProp(rng.range(rect.x + 16, rect.x + rect.w - 16), rng.range(rect.y + 16, rect.y + rect.h - 16), 'palm');
        for (let i = 0; i < 4; i += 1) addProp(rng.range(rect.x + 30, rect.x + rect.w - 30), rng.range(rect.y + 30, rect.y + rect.h - 30), 'bench');
        continue;
      }
      if (use === 'airfield') {
        if (col === 1) addBuilding(ix + iw * 0.45, iy + ih * 0.55, iw * 0.5, ih * 0.38, { name: 'Azura Airfield', sign: 'airfield', floors: 1, roof: '#8f9aa4' });
        continue;
      }
      if (use === 'marina') {
        addBuilding(ix, iy, iw * 0.4, ih * 0.3, { name: 'Marina Stores', floors: 1, roof: '#5f7f8c' });
        addBuilding(ix + iw * 0.55, iy + ih * 0.1, iw * 0.38, ih * 0.26, { floors: 1, roof: '#5f7f8c' });
        for (let i = 0; i < 7; i += 1) addProp(rng.range(rect.x + 20, rect.x + rect.w - 20), rect.y + rect.h - 26, 'crate');
        continue;
      }
      if (use === 'docks') {
        addBuilding(ix, iy + 6, iw, ih * 0.42, { name: col === 3 ? 'Azura Freight' : 'Warehouse 9', floors: 2, roof: '#6d7c86', wall: '#cfd4d2' });
        addBuilding(ix, iy + ih * 0.58, iw * 0.62, ih * 0.36, { floors: 1, roof: '#7d8c74', wall: '#e3ddc8' });
        for (let i = 0; i < 6; i += 1) addProp(rng.range(rect.x + 24, rect.x + rect.w - 24), rng.range(rect.y + rect.h * 0.5, rect.y + rect.h - 20), 'crate');
        continue;
      }
      if (use === 'lot') {
        // Two rows of parking bays along the block's middle.
        for (let s = 0; s < 6; s += 1) {
          parkedSpots.push({ x: rect.x + 44 + s * 44, y: rect.y + 78, angle: Math.PI / 2 });
          parkedSpots.push({ x: rect.x + 44 + s * 44, y: rect.y + rect.h - 78, angle: -Math.PI / 2 });
        }
        continue;
      }

      const landmark = BLOCK_LANDMARK[`${col},${row}`];
      if (landmark !== undefined) {
        addBuilding(ix + iw * 0.08, iy + ih * 0.06, iw * 0.84, ih * 0.6, { name: landmark.name, sign: landmark.sign, floors: landmark.floors });
        // A couple of cars wait outside every landmark.
        parkedSpots.push({ x: rect.x + 60, y: rect.y + rect.h - 40, angle: 0 });
        parkedSpots.push({ x: rect.x + 130, y: rect.y + rect.h - 40, angle: 0 });
        continue;
      }

      // Ordinary blocks: one tower, a pair, or a quad of pastel buildings.
      const layout = rng.pick(['quad', 'pair', 'tower', 'quad']);
      if (layout === 'tower') {
        addBuilding(ix + iw * 0.14, iy + ih * 0.14, iw * 0.72, ih * 0.72, { floors: rng.int(7, 12) });
      } else if (layout === 'pair') {
        const w = (iw - 18) / 2;
        addBuilding(ix, iy + ih * 0.1, w, ih * 0.8, {});
        addBuilding(ix + w + 18, iy + ih * 0.1, w, ih * 0.8, {});
      } else {
        const w = (iw - 16) / 2;
        const h = (ih - 16) / 2;
        addBuilding(ix, iy, w, h, {});
        addBuilding(ix + w + 16, iy, w, h, {});
        addBuilding(ix, iy + h + 16, w, h, {});
        addBuilding(ix + w + 16, iy + h + 16, w, h, {});
      }
      // Kerbside parking on the block's south face.
      if (rng.chance(0.75)) {
        const n = rng.int(1, 3);
        for (let s = 0; s < n; s += 1) parkedSpots.push({ x: rect.x + 56 + s * 62, y: rect.y + rect.h - 34, angle: 0 });
      }
    }
  }

  // Palms and lamps dress the pavements: palms near block corners, lamps along avenues.
  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const rect = blockRect(col, row);
      if (rng.chance(0.8)) addProp(rect.x + 10, rect.y + 10, 'palm');
      if (rng.chance(0.8)) addProp(rect.x + rect.w - 10, rect.y + rect.h - 10, 'palm');
      if (rng.chance(0.5)) addProp(rect.x + rect.w - 10, rect.y + 10, 'palm');
      if (rng.chance(0.5)) addProp(rect.x + 10, rect.y + rect.h - 10, 'palm');
    }
  }
  for (const c of ROADS) {
    for (let t = 130; t < WORLD.w - 60; t += 300) {
      addProp(c - ROAD_HALF - 8, t, 'lamp');
      addProp(c + ROAD_HALF + 8, t + 150, 'lamp');
      addProp(t, c - ROAD_HALF - 8, 'lamp');
    }
  }

  /** The named places the story and the HUD markers point at. */
  const south = (col, row) => {
    const r = blockRect(col, row);
    return { x: r.x + r.w / 2, y: r.y + r.h + 12 };
  };
  const centre = (col, row) => {
    const r = blockRect(col, row);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };
  const places = {
    home: { ...south(2, 4), label: 'Coral Flats (home)' },
    hospital: { ...south(1, 5), label: 'St. Coral Hospital' },
    garage: { ...south(5, 1), label: "Vera's Garage" },
    bank: { ...south(3, 3), label: 'Banco del Mar' },
    hotel: { ...south(5, 2), label: 'Palms Hotel' },
    police: { ...south(4, 4), label: 'Azura Police HQ' },
    marina: { ...centre(0, 6), label: 'Marina' },
    docks: { x: ROADS[4], y: centre(3, 6).y, label: 'Azura Docks' },
    airfield: { x: ROADS[1], y: centre(0, 0).y, label: 'Azura Airfield' },
    lot: { ...centre(5, 5), label: 'Ocean Drive Lot' },
  };

  return { buildings, props, blocks, parkedSpots, places };
}

/**
 * Keep a circle inside the city and out of every building. Returns [x, y, hitSomething]:
 * the resolved position, and whether a wall stopped it (cars take damage from that).
 */
export function collideCircle(city, x, y, r) {
  let hit = false;
  let nx = clamp(x, r, WORLD.w - r);
  let ny = clamp(y, r, WORLD.h - r);
  if (nx !== x || ny !== y) hit = true;
  for (const b of city.buildings) {
    if (nx + r < b.x || nx - r > b.x + b.w || ny + r < b.y || ny - r > b.y + b.h) continue;
    // Inline push-out (the same shallowest-exit rule as util.pushCircleOutOfBox).
    const cx = clamp(nx, b.x, b.x + b.w);
    const cy = clamp(ny, b.y, b.y + b.h);
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      if (d < r) {
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
        hit = true;
      }
    } else {
      const left = nx - b.x + r;
      const right = b.x + b.w - nx + r;
      const top = ny - b.y + r;
      const bottom = b.y + b.h - ny + r;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.x - r;
      else if (m === right) nx = b.x + b.w + r;
      else if (m === top) ny = b.y - r;
      else ny = b.y + b.h + r;
      hit = true;
    }
  }
  return [nx, ny, hit];
}

/** A random point on a random road, away from the given spot if asked. */
export function randomRoadPoint(rng, awayFrom = null, minAway = 0) {
  for (let tries = 0; tries < 12; tries += 1) {
    const vertical = rng.chance(0.5);
    const c = rng.pick(ROADS);
    const t = rng.range(90, WORLD.w - 90);
    const x = vertical ? c : t;
    const y = vertical ? t : c;
    if (awayFrom !== null) {
      const dx = x - awayFrom.x;
      const dy = y - awayFrom.y;
      if (dx * dx + dy * dy < minAway * minAway) continue;
    }
    return { x, y };
  }
  return { x: ROADS[3], y: ROADS[3] };
}

/** The intersection nearest a point, as [column, row] indices into ROADS. */
export function nearestNode(x, y) {
  let ci = 0;
  let ri = 0;
  let best = Infinity;
  for (let i = 0; i < ROADS.length; i += 1) {
    const d = Math.abs(x - ROADS[i]);
    if (d < best) {
      best = d;
      ci = i;
    }
  }
  best = Infinity;
  for (let j = 0; j < ROADS.length; j += 1) {
    const d = Math.abs(y - ROADS[j]);
    if (d < best) {
      best = d;
      ri = j;
    }
  }
  return [ci, ri];
}
