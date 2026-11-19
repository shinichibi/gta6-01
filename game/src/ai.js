// The city's own drivers and walkers, and the law that answers the wanted stars:
// traffic that follows the avenue graph lane by lane, pedestrians on the pavement
// lines, police cars that hunt and ram, officers on foot, and the heat that fades
// when nobody in uniform can see the player.

import { HEAT_DECAY, HEAT_HIDE_SECONDS, LANE_OFF, ROADS, ROAD_HALF, WORLD } from './config.js';
import { nearestNode, randomRoadPoint } from './city.js';
import { createBoat, createCar, createPed, forwardSpeed, stepBoat, stepCar } from './entities.js';
import { angleDelta, clamp, dist } from './util.js';

/** Pavement lines run this far outside each road's kerb, on both axes. */
const PAVEMENT_OFF = ROAD_HALF + 10;

/** Stars showing for a heat value: one per full hundred, five at most. */
export function starsForHeat(heat) {
  return Math.min(5, Math.floor(heat / 100));
}

/** Do any buildings block the straight line between two points? */
export function lineBlocked(city, x1, y1, x2, y2) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 22);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (const b of city.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    }
  }
  return false;
}

/** Steer a car toward a point: returns the {throttle, steer, handbrake} control for stepCar. */
function steerToward(car, tx, ty, wantedSpeed, dt) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const delta = angleDelta(car.angle, want);
  const steer = clamp(delta * 2.4, -1, 1);
  const speed = forwardSpeed(car);
  let throttle = 0;
  if (Math.abs(delta) > 2.5) {
    // Target is behind: reverse toward it rather than loop the block.
    throttle = speed > -90 ? -1 : 0;
    return { throttle, steer: -steer, handbrake: false };
  }
  if (speed < wantedSpeed) throttle = 1;
  else if (speed > wantedSpeed + 60) throttle = -0.7;
  return { throttle, steer, handbrake: false };
}

/** The car or person directly ahead of `car` within `range`, if any (traffic queues on this). */
function obstacleAhead(G, car, range) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  let bestD = range;
  const check = (other, radius) => {
    if (other === car) return;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 4 || ahead > bestD) return;
    const side = Math.abs(dx * -fy + dy * fx);
    if (side < radius + car.wid * 0.6 && ahead < bestD) {
      bestD = ahead;
      best = other;
    }
  };
  for (const other of G.cars) check(other, other.len * 0.4);
  return best;
}

// ---------------------------------------------------------------- traffic

/** Keep a living ring of traffic around the player; far cars retire, near ones arrive. */
export function manageTraffic(G, dt) {
  G.spawnT -= dt;
  const p = G.player;
  G.cars = G.cars.filter((car) => {
    if (car.driver !== 'traffic') return true;
    return dist(car.x, car.y, p.x, p.y) < 1750;
  });
  const traffic = G.cars.filter((car) => car.driver === 'traffic');
  if (traffic.length < 12 && G.spawnT <= 0) {
    G.spawnT = 0.7;
    const spot = randomRoadPoint(G.rng, p, 820);
    if (dist(spot.x, spot.y, p.x, p.y) > 780) {
      const [ci, ri] = nearestNode(spot.x, spot.y);
      const car = createCar(G.rng.pick(['sedan', 'hatch', 'sedan', 'taxi', 'van', 'pickup']), ROADS[ci], ROADS[ri], 0, null, G.rng);
      car.driver = 'traffic';
      car.ai.node = [ci, ri];
      car.ai.target = null;
      G.cars.push(car);
    }
  }
}

/** Drive one traffic car along the avenue graph, queuing behind whatever is ahead. */
export function updateTrafficCar(G, car, dt) {
  if (car.ai.target === null) {
    const [ci, ri] = car.ai.node;
    const options = [];
    if (ci > 0) options.push([ci - 1, ri]);
    if (ci < ROADS.length - 1) options.push([ci + 1, ri]);
    if (ri > 0) options.push([ci, ri - 1]);
    if (ri < ROADS.length - 1) options.push([ci, ri + 1]);
    const back = car.ai.from;
    const forward = options.filter(([a, b]) => back === undefined || a !== back[0] || b !== back[1]);
    const next = G.rng.pick(forward.length > 0 ? forward : options);
    car.ai.from = [ci, ri];
    car.ai.node = next;
    // Lane point: aim at the far end of the segment, offset to the right-hand lane.
    const dx = Math.sign(next[0] - ci);
    const dy = Math.sign(next[1] - ri);
    let tx = ROADS[next[0]];
    let ty = ROADS[next[1]];
    if (dx > 0) ty += LANE_OFF;
    else if (dx < 0) ty -= LANE_OFF;
    else if (dy > 0) tx -= LANE_OFF;
    else if (dy < 0) tx += LANE_OFF;
    car.ai.target = { x: tx, y: ty };
  }
  const target = car.ai.target;
  const d = dist(car.x, car.y, target.x, target.y);
  if (d < 34) {
    car.ai.target = null;
    return;
  }
  let wanted = 245;
  const obstacle = obstacleAhead(G, car, 105);
  if (obstacle !== null) wanted = Math.min(wanted, Math.max(0, forwardSpeed(obstacle)) * 0.9);
  if (d < 90) wanted = Math.min(wanted, 120);
  const control = steerToward(car, target.x, target.y, wanted, dt);
  const impact = stepCar(car, control, dt, G.city);
  if (impact > 0) G.onCarHitWall(car, impact);
}

// ---------------------------------------------------------------- pedestrians

/** Pavement line coordinates on one axis: both kerbs of every avenue. */
function pavementLines() {
  const lines = [];
  for (const c of ROADS) {
    lines.push(c - PAVEMENT_OFF);
    lines.push(c + PAVEMENT_OFF);
  }
  return lines;
}
const LINES = pavementLines();

/** Keep walkers on the pavements around the player. */
export function managePeds(G, dt) {
  G.pedT -= dt;
  const p = G.player;
  G.peds = G.peds.filter((ped) => {
    if (ped.dead) return ped.downT > 0;
    if (ped.role !== 'walker' && ped.role !== 'jogger') return true;
    return dist(ped.x, ped.y, p.x, p.y) < 1400;
  });
  const walkers = G.peds.filter((ped) => (ped.role === 'walker' || ped.role === 'jogger') && !ped.dead);
  if (walkers.length < 24 && G.pedT <= 0) {
    G.pedT = 0.5;
    const vertical = G.rng.chance(0.5);
    const line = G.rng.pick(LINES);
    const t = clamp(p[vertical ? 'y' : 'x'] + G.rng.range(-950, 950), 40, WORLD.w - 40);
    // One pavement user in five is a jogger, bright-shirted and twice the pace.
    const ped = createPed(G.rng, vertical ? line : t, vertical ? t : line, G.rng.chance(0.2) ? 'jogger' : 'walker');
    ped.axis = vertical ? 'v' : 'h';
    G.peds.push(ped);
  }
}

/** Walk one pedestrian along the pavements, or run them from danger. */
export function updatePed(G, ped, dt) {
  if (ped.dead) {
    ped.downT -= dt;
    return;
  }
  if (ped.role === 'cop') {
    updateFootCop(G, ped, dt);
    return;
  }
  if (ped.role === 'client') return; // mission code moves clients
  if (ped.panicT > 0) {
    ped.panicT -= dt;
    const dx = ped.x - G.threat.x;
    const dy = ped.y - G.threat.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * 205 * dt;
    ped.y += (dy / d) * 205 * dt;
    const [nx, ny] = collidePavement(G, ped);
    ped.x = nx;
    ped.y = ny;
    return;
  }
  // Amble along the current pavement line; sometimes turn at a junction.
  const speed = ped.walkSpeed;
  if (ped.axis === 'v') {
    ped.y += ped.dir * speed * dt;
    ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const line of LINES) {
      if (Math.abs(ped.y - line) < speed * dt && G.rng.chance(0.24)) {
        ped.axis = 'h';
        ped.y = line;
        ped.dir = G.rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    if (ped.y < 30 || ped.y > WORLD.h - 30) ped.dir *= -1;
  } else {
    ped.x += ped.dir * speed * dt;
    ped.angle = ped.dir > 0 ? 0 : Math.PI;
    for (const line of LINES) {
      if (Math.abs(ped.x - line) < speed * dt && G.rng.chance(0.24)) {
        ped.axis = 'v';
        ped.x = line;
        ped.dir = G.rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    if (ped.x < 30 || ped.x > WORLD.w - 30) ped.dir *= -1;
  }
  ped.walkCycle = (ped.walkCycle ?? 0) + dt * 7 * (ped.walkSpeed / 65);
}

// ---------------------------------------------------------------- harbour

/** The ambient fleet's circuit: a wide rectangle of open water around the island. */
const BOAT_LOOP = [
  { x: -320, y: -320 },
  { x: WORLD.w + 320, y: -320 },
  { x: WORLD.w + 320, y: WORLD.h + 320 },
  { x: -320, y: WORLD.h + 320 },
];

/** Keep two boats — a yacht and a skiff — endlessly circling the island. */
export function manageBoats(G, dt) {
  G.boatT -= dt;
  const p = G.player;
  G.boats = G.boats.filter((boat) => boat.driver !== 'ambient' || dist(boat.x, boat.y, p.x, p.y) < 2600);
  const ambient = G.boats.filter((boat) => boat.driver === 'ambient' && !boat.wrecked);
  if (ambient.length < 2 && G.boatT <= 0) {
    G.boatT = 1.2;
    const corner = G.rng.int(0, BOAT_LOOP.length - 1);
    const at = BOAT_LOOP[corner];
    if (dist(at.x, at.y, p.x, p.y) > 900) {
      const type = ambient.some((boat) => boat.type === 'yacht') ? 'skiff' : 'yacht';
      const boat = createBoat(type, at.x, at.y, 0, null, G.rng);
      boat.driver = 'ambient';
      boat.ai.wp = (corner + 1) % BOAT_LOOP.length;
      G.boats.push(boat);
    }
  }
}

/** Steer one ambient boat around the island, laying a wake as it goes. */
export function updateAmbientBoat(G, boat, dt) {
  const target = BOAT_LOOP[boat.ai.wp];
  if (dist(boat.x, boat.y, target.x, target.y) < 170) {
    boat.ai.wp = (boat.ai.wp + 1) % BOAT_LOOP.length;
    return;
  }
  const want = Math.atan2(target.y - boat.y, target.x - boat.x);
  const delta = angleDelta(boat.angle, want);
  const steer = clamp(delta * 1.8, -1, 1);
  const speed = forwardSpeed(boat);
  const wanted = boat.type === 'yacht' ? 195 : 250;
  const throttle = speed < wanted ? 1 : 0;
  stepBoat(boat, { throttle, steer, handbrake: false }, dt);
  boat.ai.wakeT -= dt;
  if (speed > 90 && boat.ai.wakeT <= 0) {
    boat.ai.wakeT = 0.09;
    G.fx.wake(boat.x - Math.cos(boat.angle) * boat.len * 0.5, boat.y - Math.sin(boat.angle) * boat.len * 0.5, boat.type === 'yacht');
  }
}

/** Buildings and the shoreline stop a running pedestrian, as they stop anyone. */
function collidePavement(G, ped) {
  let { x, y } = ped;
  x = clamp(x, 12, WORLD.w - 12);
  y = clamp(y, 12, WORLD.h - 12);
  for (const b of G.city.buildings) {
    if (x + 9 < b.x || x - 9 > b.x + b.w || y + 9 < b.y || y - 9 > b.y + b.h) continue;
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 9) {
      x = cx + (dx / d) * 9;
      y = cy + (dy / d) * 9;
    }
  }
  return [x, y];
}

/** Frighten every walker near a point (a gunshot, a near miss, a crash). */
export function scarePeds(G, x, y, radius) {
  G.threat = { x, y };
  for (const ped of G.peds) {
    if ((ped.role === 'walker' || ped.role === 'jogger') && !ped.dead && dist(ped.x, ped.y, x, y) < radius) ped.panicT = Math.max(ped.panicT, 1.6);
  }
}

// ---------------------------------------------------------------- police

/**
 * The wanted system: heat becomes stars; stars summon patrol cars; heat cools
 * while no officer can see the player. Spawning keeps its distance (off-screen).
 */
export function updatePolice(G, dt) {
  const wanted = G.wanted;
  const p = G.player;
  wanted.stars = starsForHeat(wanted.heat);

  // Who can see the player right now?
  let seen = false;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    if (dist(car.x, car.y, p.x, p.y) < 460 && !lineBlocked(G.city, car.x, car.y, p.x, p.y)) seen = true;
  }
  for (const ped of G.peds) {
    if (ped.role === 'cop' && !ped.dead && dist(ped.x, ped.y, p.x, p.y) < 380 && !lineBlocked(G.city, ped.x, ped.y, p.x, p.y)) seen = true;
  }
  wanted.seen = seen;
  if (seen) wanted.unseenT = 0;
  else {
    wanted.unseenT += dt;
    if (wanted.unseenT > HEAT_HIDE_SECONDS && wanted.heat > 0) {
      wanted.heat = Math.max(0, wanted.heat - HEAT_DECAY * dt);
      wanted.stars = starsForHeat(wanted.heat);
    }
  }

  const policeCars = G.cars.filter((car) => car.driver === 'police');
  const desired = wanted.stars === 0 ? 0 : Math.min(6, wanted.stars + 1);
  G.policeT -= dt;
  if (policeCars.length < desired && G.policeT <= 0) {
    G.policeT = 1.6;
    const spot = randomRoadPoint(G.rng, p, 760);
    if (dist(spot.x, spot.y, p.x, p.y) > 720) {
      const [ci, ri] = nearestNode(spot.x, spot.y);
      const car = createCar('police', ROADS[ci], ROADS[ri], 0, null, G.rng);
      car.driver = 'police';
      G.cars.push(car);
    }
  }
  // Patrols that lose the trail entirely give up and leave the world.
  G.cars = G.cars.filter((car) => {
    if (car.driver !== 'police') return true;
    if (wanted.stars === 0 && dist(car.x, car.y, p.x, p.y) > 620) return false;
    return dist(car.x, car.y, p.x, p.y) < 1900;
  });
}

/** One patrol car hunting: run the player down, ram, and put an officer out on foot. */
export function updatePoliceCar(G, car, dt) {
  const p = G.player;
  if (car.wrecked) return;
  const lead = p.car !== null ? 0.45 : 0.15;
  const tx = p.x + (p.car !== null ? p.car.vx * lead : 0);
  const ty = p.y + (p.car !== null ? p.car.vy * lead : 0);
  const d = dist(car.x, car.y, p.x, p.y);

  // Put an officer on foot when the player is afoot and the car has drawn close.
  if (p.car === null && d < 150 && Math.abs(forwardSpeed(car)) < 70 && !car.ai.deployed) {
    car.ai.deployed = true;
    const cop = createPed(G.rng, car.x + 16, car.y + 10, 'cop');
    cop.car = car;
    G.peds.push(cop);
    if (G.wanted.stars >= 3) {
      const second = createPed(G.rng, car.x - 16, car.y - 10, 'cop');
      second.car = car;
      G.peds.push(second);
    }
  }
  if (p.car === null && car.ai.deployed && d < 170) {
    // The driver waits with the car while the officers work.
    stepCar(car, { throttle: forwardSpeed(car) > 10 ? -0.6 : 0, steer: 0, handbrake: true }, dt, G.city);
    return;
  }
  const wantedSpeed = d > 300 ? car.topSpeed : Math.max(240, car.topSpeed * 0.72);
  const control = steerToward(car, tx, ty, wantedSpeed, dt);
  const impact = stepCar(car, control, dt, G.city);
  if (impact > 0) G.onCarHitWall(car, impact);
}

/** An officer on foot: close to firing range, hold it, and shoot on a cadence. */
export function updateFootCop(G, ped, dt) {
  const p = G.player;
  if (G.wanted.stars === 0) {
    // The heat is gone: walk back toward the car and stand down.
    if (ped.car !== null && dist(ped.x, ped.y, ped.car.x, ped.car.y) > 30) {
      ped.angle = Math.atan2(ped.car.y - ped.y, ped.car.x - ped.x);
      ped.x += Math.cos(ped.angle) * 120 * dt;
      ped.y += Math.sin(ped.angle) * 120 * dt;
    }
    return;
  }
  const d = dist(ped.x, ped.y, p.x, p.y);
  ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
  const blocked = lineBlocked(G.city, ped.x, ped.y, p.x, p.y);
  if ((d > 175 || blocked) && d > 60) {
    ped.x += Math.cos(ped.angle) * 172 * dt;
    ped.y += Math.sin(ped.angle) * 172 * dt;
    const [nx, ny] = collidePavement(G, ped);
    ped.x = nx;
    ped.y = ny;
  } else if (d < 95) {
    ped.x -= Math.cos(ped.angle) * 90 * dt;
    ped.y -= Math.sin(ped.angle) * 90 * dt;
  }
  ped.shootCd -= dt;
  if (G.wanted.stars >= 2 && d < 300 && !blocked && ped.shootCd <= 0) {
    ped.shootCd = G.rng.range(0.85, 1.35);
    ped.wantFire = true; // combat.js turns this into a bullet
  }
}
