// Port Azura's map: a 7 by 7 grid of blocks between eight avenues each way. This file
// generates the blocks, buildings (with their neon signs and lit-window seeds), the
// special places the story points at, the two harbour piers, and the collision test
// every moving thing shares.

import { PALETTE, ROADS, ROAD_HALF, WORLD } from './config.js';
import { clamp } from './util.js';

/** The land rectangle of one block: `col`/`row` run 0..6 between consecutive avenues. */
export function blockRect(col, row) {
  const x0 = ROADS[col] + ROAD_HALF;
  const x1 = ROADS[col + 1] - ROAD_HALF;
  const y0 = ROADS[row] + ROAD_HALF;
  const y1 = ROADS[row + 1] - ROAD_HALF;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** True when the point is on tarmac (a road strip in either direction). */
export function isOnRoad(x, y) {
  for (const r of ROADS) {
    if (Math.abs(x - r) <= ROAD_HALF || Math.abs(y - r) <= ROAD_HALF) return true;
  }
  return false;
}

// Blocks with a job: open ground instead of buildings.
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

// Landmark buildings: { key: place the story uses, name: sign over the door, floors }.
const BLOCK_LANDMARK = {
  '1,5': { place: 'hospital', name: 'St. Coral Hospital', floors: 6 },
  '5,1': { place: 'garage', name: "Vera's Garage", floors: 2, neon: { text: "VERA'S", color: '#ff9a3d' } },
  '3,3': { place: 'bank', name: 'Banco del Mar', floors: 8, neon: { text: 'BANCO', color: '#37e0ff' } },
  '5,2': { place: 'hotel', name: 'Palms Hotel', floors: 9, neon: { text: 'PALMS', color: '#ff5d8f' } },
  '4,4': { place: 'police', name: 'Azura Police HQ', floors: 5, neon: { text: 'AZURA PD', color: '#5aa0ff' } },
  '2,4': { place: 'home', name: 'Coral Flats', floors: 7 },
};

// The neon strip: rooftop signs for ordinary towers in the downtown blocks, so the
// centre of the city glows after dark. Names are the city's own bars and clubs.
const NEON_SIGNS = [
  { text: 'CLUB SIRENA', color: '#ff5df2' },
  { text: 'CAFÉ AZUL', color: '#37e0ff' },
  { text: 'BAR LUMEN', color: '#ffe14d' },
  { text: 'DISCO FARO', color: '#37e0a0' },
  { text: 'HOTEL SOL', color: '#ff9a3d' },
  { text: 'CASINO MAR', color: '#ff5d8f' },
  { text: 'TIDE MALL', color: '#8ab8ff' },
  { text: 'NEON PALMS', color: '#5dff8a' },
];

/** Downtown blocks (around the bank) where towers carry neon signs. */
const NEON_BLOCKS = new Set(['2,2', '2,3', '3,2', '3,4', '4,2', '4,3', '2,4', '4,4', '3,3']);

/**
 * Build the whole city from the seeded rng: blocks, buildings, props, parked-car
 * spots, the harbour piers, and the named places missions navigate by.
 */
export function createCity(rng) {
  const blocks = [];
  const buildings = [];
  const props = [];
  const parkedSpots = [];
  let neonIdx = 0;

  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const rect = blockRect(col, row);
      const key = `${col},${row}`;
      const use = BLOCK_USE[key] ?? 'buildings';
      blocks.push({ col, row, ...rect, use });

      if (use === 'lot') {
        for (let i = 0; i < 12; i += 1) {
          parkedSpots.push({
            x: rect.x + 34 + (i % 4) * 62,
            y: rect.y + 40 + Math.floor(i / 4) * 92,
            angle: Math.PI / 2,
          });
        }
        continue;
      }
      if (use === 'park') {
        for (let i = 0; i < 12; i += 1) {
          props.push({ kind: 'palm', x: rng.range(rect.x + 16, rect.x + rect.w - 16), y: rng.range(rect.y + 16, rect.y + rect.h - 16) });
        }
        for (let i = 0; i < 3; i += 1) {
          props.push({ kind: 'bench', x: rng.range(rect.x + 30, rect.x + rect.w - 30), y: rng.range(rect.y + 30, rect.y + rect.h - 30) });
        }
        continue;
      }
      if (use === 'airfield') {
        if (col === 1) {
          buildings.push({
            x: rect.x + 130, y: rect.y + 150, w: 150, h: 110, floors: 1,
            wall: '#e3ddc8', roof: '#8f9aa4', name: 'Azura Airfield', neon: null,
            winSeed: rng.int(1, 99991), place: null, roofProps: [],
          });
        }
        continue;
      }
      if (use === 'marina' || use === 'docks') {
        const shed = (x, y, w, h, name, roof) => buildings.push({
          x, y, w, h, floors: 1, wall: '#e3ddc8', roof, name, neon: null,
          winSeed: rng.int(1, 99991), place: null, roofProps: [],
        });
        if (use === 'marina') {
          shed(rect.x + 20, rect.y + 20, 120, 92, 'Marina Stores', '#5f7f8c');
          shed(rect.x + 190, rect.y + 40, 104, 78, null, '#5f7f8c');
        } else {
          shed(rect.x + 20, rect.y + 26, rect.w - 40, 120, col === 3 ? 'Azura Freight' : 'Warehouse 9', '#6d7c86');
          shed(rect.x + 20, rect.y + 190, 190, 100, null, '#7d8c74');
        }
        continue;
      }
      if (use !== 'buildings') continue;

      const landmark = BLOCK_LANDMARK[key];
      if (landmark) {
        buildings.push({
          x: rect.x + 46,
          y: rect.y + 52,
          w: rect.w - 92,
          h: rect.h - 104,
          floors: landmark.floors,
          wall: rng.pick(PALETTE.buildingWalls),
          roof: rng.pick(PALETTE.buildingRoofs),
          name: landmark.name,
          sign: landmark.place,
          neon: landmark.neon ?? null,
          winSeed: rng.int(1, 99991),
          place: landmark.place,
          roofProps: [],
        });
        parkedSpots.push({ x: rect.x + 60, y: rect.y + rect.h - 30, angle: 0 });
        parkedSpots.push({ x: rect.x + 130, y: rect.y + rect.h - 30, angle: 0 });
        continue;
      }

      // Ordinary blocks: one tower, a mirrored pair, or four slabs.
      const layout = rng.pick(['tower', 'pair', 'quad']);
      const inset = 20;
      const mk = (x, y, w, h) => {
        const floors = rng.int(2, 12);
        let neon = null;
        if (floors >= 5 && NEON_BLOCKS.has(key)) {
          neon = NEON_SIGNS[neonIdx % NEON_SIGNS.length];
          neonIdx += 1;
        }
        buildings.push({
          x,
          y,
          w,
          h,
          floors,
          wall: rng.pick(PALETTE.buildingWalls),
          roof: rng.pick(PALETTE.buildingRoofs),
          name: null,
          neon,
          winSeed: rng.int(1, 99991),
          place: null,
          roofProps: Array.from({ length: rng.int(1, 3) }, () => ({
            dx: rng.range(8, Math.max(9, w - 26)),
            dy: rng.range(8, Math.max(9, h - 26)),
            s: rng.range(10, 22),
          })),
        });
      };
      if (layout === 'tower') {
        mk(rect.x + inset + 26, rect.y + inset + 26, rect.w - inset * 2 - 52, rect.h - inset * 2 - 52);
      } else if (layout === 'pair') {
        const w = (rect.w - inset * 2 - 22) / 2;
        mk(rect.x + inset, rect.y + inset, w, rect.h - inset * 2);
        mk(rect.x + inset + w + 22, rect.y + inset, w, rect.h - inset * 2);
      } else {
        const w = (rect.w - inset * 2 - 18) / 2;
        const h = (rect.h - inset * 2 - 18) / 2;
        mk(rect.x + inset, rect.y + inset, w, h);
        mk(rect.x + inset + w + 18, rect.y + inset, w, h);
        mk(rect.x + inset, rect.y + inset + h + 18, w, h);
        mk(rect.x + inset + w + 18, rect.y + inset + h + 18, w, h);
      }

      // Kerbside parking on most blocks.
      if (rng.chance(0.75)) {
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i += 1) {
          parkedSpots.push({
            x: rect.x + 30 + i * 62,
            y: rect.y + rect.h + 26,
            angle: 0,
          });
        }
      }
    }
  }

  // Palms at block corners, lamps along the avenues.
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const rect = blockRect(col, row);
      if (rng.chance(0.8)) props.push({ kind: 'palm', x: rect.x + 10, y: rect.y + 10 });
      if (rng.chance(0.8)) props.push({ kind: 'palm', x: rect.x + rect.w - 10, y: rect.y + rect.h - 10 });
      if (rng.chance(0.5)) props.push({ kind: 'palm', x: rect.x + rect.w - 10, y: rect.y + 10 });
      if (rng.chance(0.5)) props.push({ kind: 'palm', x: rect.x + 10, y: rect.y + rect.h - 10 });
    }
  }
  for (const r of ROADS) {
    for (let d = 160; d < WORLD.w; d += 300) {
      props.push({ kind: 'lamp', x: r - ROAD_HALF - 8, y: d });
      props.push({ kind: 'lamp', x: d, y: r + ROAD_HALF + 8 });
    }
  }
  // Crates and benches dress the docks and the marina.
  const docks = blockRect(3, 6);
  for (let i = 0; i < 8; i += 1) props.push({ kind: 'crate', x: docks.x + 26 + i * 30, y: docks.y + docks.h - 30 });
  const marina = blockRect(0, 6);
  for (let i = 0; i < 4; i += 1) props.push({ kind: 'bench', x: marina.x + 40 + i * 66, y: marina.y + marina.h - 24 });

  // The harbour: two wooden piers reaching off the south shore, a boat tied to each,
  // and the shore points where a crew stepping off a boat comes ashore.
  const piers = [
    { x: 440, y0: WORLD.h, y1: WORLD.h + 128 },
    { x: ROADS[4], y0: WORLD.h, y1: WORLD.h + 128 },
  ];
  const boatDocks = [
    { x: 440 + 34, y: WORLD.h + 96, angle: Math.PI / 2, type: 'skiff' },
    { x: ROADS[4] - 34, y: WORLD.h + 96, angle: Math.PI / 2, type: 'skiff' },
  ];

  const centre = (col, row) => {
    const r = blockRect(col, row);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };
  const southOf = (col, row) => {
    const r = blockRect(col, row);
    return { x: r.x + r.w / 2, y: r.y + r.h + 12 };
  };
  const places = {
    home: { ...southOf(2, 4), label: 'Coral Flats (home)' },
    hospital: { ...southOf(1, 5), label: 'St. Coral Hospital' },
    garage: { ...southOf(5, 1), label: "Vera's Garage" },
    bank: { ...southOf(3, 3), label: 'Banco del Mar' },
    hotel: { ...southOf(5, 2), label: 'Palms Hotel' },
    police: { ...southOf(4, 4), label: 'Azura Police HQ' },
    marina: { ...centre(0, 6), label: 'Marina' },
    docks: { x: ROADS[4], y: centre(3, 6).y, label: 'Azura Docks' },
    airfield: { x: ROADS[1], y: centre(0, 0).y, label: 'Azura Airfield' },
    lot: { ...centre(5, 5), label: 'Ocean Drive Lot' },
    pierMarina: { x: 440, y: WORLD.h - 16, label: 'Marina Pier' },
    pierDocks: { x: ROADS[4], y: WORLD.h - 16, label: 'Docks Pier' },
    // Where the Sirena rides at anchor during Salt Air: open water east of the city.
    yachtAnchor: { x: WORLD.w + 430, y: 1760, label: 'the anchored Sirena' },
  };

  return { blocks, buildings, props, parkedSpots, piers, boatDocks, places };
}

/**
 * Push a circle at (x, y) out of every building and clamp it inside the city.
 * Returns [x, y, hitSomething]. The one collision rule cars and walkers share.
 */
export function collideCircle(city, x, y, r) {
  let hit = false;
  let nx = clamp(x, r, WORLD.w - r);
  let ny = clamp(y, r, WORLD.h - r);
  if (nx !== x || ny !== y) hit = true;
  for (const b of city.buildings) {
    if (nx + r < b.x || nx - r > b.x + b.w || ny + r < b.y || ny - r > b.y + b.h) continue;
    // Push out from the closest point on the building: round corners, no sticking.
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

/** A random point on a random avenue, away from the given spot if asked. */
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
