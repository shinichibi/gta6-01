// The people and machines of Port Azura: the player, every car (one physics model
// shared by the player's driving, traffic and the police), the harbour's boats
// (their own, lazier physics — water forgives what asphalt does not), and
// pedestrians. Controllers live in ai.js; this file owns shapes, stats and movement.

import { BOAT_COLORS, CAR_COLORS, SHORE, WEAPONS, WORLD } from './config.js';
import { collideCircle } from './city.js';
import { clamp, circleBoxOverlap, pushCircleOutOfBox } from './util.js';

/** Car models: size, pace and toughness. `name` is what the HUD calls them. */
export const CAR_TYPES = {
  sedan: { name: 'Marina Sedan', len: 46, wid: 22, topSpeed: 470, accel: 370, hp: 120 },
  hatch: { name: 'Pico Hatch', len: 42, wid: 21, topSpeed: 435, accel: 350, hp: 100 },
  sports: { name: 'Comet GT', len: 48, wid: 22, topSpeed: 645, accel: 500, hp: 110 },
  taxi: { name: 'City Cab', len: 46, wid: 22, topSpeed: 460, accel: 360, hp: 120 },
  van: { name: 'Bastion Van', len: 58, wid: 27, topSpeed: 395, accel: 300, hp: 260 },
  pickup: { name: 'Dune Pickup', len: 52, wid: 24, topSpeed: 520, accel: 415, hp: 190 },
  police: { name: 'Azura PD Interceptor', len: 47, wid: 23, topSpeed: 560, accel: 460, hp: 170 },
};

/** Boat models: the skiff is quick and twitchy; the yacht is a floating lounge. */
export const BOAT_TYPES = {
  skiff: { name: 'Tide Skiff', len: 46, wid: 19, topSpeed: 540, accel: 320, hp: 120 },
  yacht: { name: 'Sirena Yacht', len: 86, wid: 30, topSpeed: 430, accel: 215, hp: 320 },
};

/** The player: Jax Marlowe, wheelman. On foot until `car` or `boat` names his ride. */
export function createPlayer(x, y) {
  return {
    kind: 'player',
    x,
    y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 12,
    hp: 100,
    maxHp: 100,
    car: null,
    boat: null,
    walkCycle: 0,
    moving: false,
    fireCd: 0,
    // The arsenal: `mag`/`reserve`/`magSize` always mirror the gun in hand, and
    // `ammo` keeps each gun's own count for the swap. Vera's SMG arrives mid-story.
    weapon: 'pistol',
    hasSmg: false,
    ammo: {
      pistol: { mag: WEAPONS.pistol.magSize, reserve: 96 },
      smg: { mag: WEAPONS.smg.magSize, reserve: 150 },
    },
    mag: WEAPONS.pistol.magSize,
    magSize: WEAPONS.pistol.magSize,
    reserve: 96,
    reloadT: 0,
    hurtT: 0,
  };
}

/** A car. `driver` is 'parked', 'traffic', 'police', 'player' or 'mission'. */
export function createCar(type, x, y, angle, color, rng) {
  const spec = CAR_TYPES[type];
  return {
    kind: 'car',
    type,
    name: spec.name,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    len: spec.len,
    wid: spec.wid,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    hp: spec.hp,
    maxHp: spec.hp,
    color: color ?? (type === 'police' ? '#20242c' : type === 'taxi' ? '#f2b63d' : rng.pick(CAR_COLORS)),
    driver: 'parked',
    // Traffic/police steering state, owned by ai.js.
    ai: { node: null, target: null, speedWanted: 0, stuckT: 0, lastX: x, lastY: y },
    wrecked: false,
    missionCar: false,
    flashT: 0,
    sirenPhase: rng.range(0, 6),
  };
}

/** A boat. `driver` is 'docked', 'ambient', 'anchored', 'player' or 'mission'. */
export function createBoat(type, x, y, angle, color, rng) {
  const spec = BOAT_TYPES[type];
  return {
    kind: 'boat',
    type,
    name: spec.name,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    len: spec.len,
    wid: spec.wid,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    hp: spec.hp,
    maxHp: spec.hp,
    color: color ?? rng.pick(BOAT_COLORS),
    driver: 'docked',
    // Harbour steering state, owned by ai.js: a waypoint index and a wake timer.
    ai: { wp: 0, wakeT: 0 },
    wrecked: false,
    missionBoat: false,
    flashT: 0,
  };
}

/** A pedestrian. Roles: 'walker', 'jogger' on the move, 'cop' on foot patrol, 'client' waiting for a ride. */
export function createPed(rng, x, y, role = 'walker') {
  return {
    kind: 'ped',
    role,
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    radius: 9,
    hp: role === 'cop' ? 45 : 30,
    speed: 0,
    walkCycle: 0,
    walkSpeed: role === 'jogger' ? rng.range(148, 178) : rng.range(52, 78),
    shirt: role === 'cop' ? '#2c4a7c' : role === 'jogger' ? rng.pick(['#ff5d8f', '#ffe14d', '#37e0a0', '#ff7a3d']) : rng.pick(['#e86a5a', '#5ab0e8', '#f2e3c6', '#7fc96b', '#e8b7c8', '#f2b63d', '#fdf6ec', '#63c7b2']),
    skin: rng.pick(['#f2c79b', '#c68863', '#8a5a3b', '#ffdbb4', '#6e452a']),
    state: 'walk',
    // Pavement walking: along one axis on one pavement line, turning at junctions.
    axis: rng.chance(0.5) ? 'v' : 'h',
    dir: rng.chance(0.5) ? 1 : -1,
    panicT: 0,
    downT: 0,
    flashT: 0,
    shootCd: rng.range(0.4, 1.2),
    car: null, // the police car a foot cop came from
    dead: false,
  };
}

/** Forward speed of a car or boat along its nose (negative when reversing). */
export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

/**
 * Advance one car by dt under a control input {throttle -1..1, steer -1..1, handbrake}.
 * Arcade physics: strong forward drive, lateral grip that the handbrake loosens.
 * Returns the impact speed if the car struck a building or the city rim, else 0.
 */
export function stepCar(car, control, dt, city) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let fSpeed = car.vx * fx + car.vy * fy;
  let lSpeed = car.vx * -fy + car.vy * fx;

  if (control.throttle > 0) fSpeed += car.accel * control.throttle * dt * (fSpeed < 0 ? 2.4 : 1);
  else if (control.throttle < 0) fSpeed += car.accel * control.throttle * dt * (fSpeed > 0 ? 2.4 : 0.55);
  fSpeed -= fSpeed * 0.55 * dt; // rolling drag
  if (control.handbrake) fSpeed -= fSpeed * 1.4 * dt;
  fSpeed = clamp(fSpeed, -car.topSpeed * 0.38, car.topSpeed);

  const steerAuthority = clamp(Math.abs(fSpeed) / 130, 0, 1) * Math.sign(fSpeed);
  car.angle += control.steer * 1.9 * steerAuthority * dt * (control.handbrake ? 1.35 : 1);

  const grip = control.handbrake ? 2.2 : 9.5;
  lSpeed -= lSpeed * Math.min(1, grip * dt);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * fSpeed + -nfy * lSpeed;
  car.vy = nfy * fSpeed + nfx * lSpeed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const before = Math.abs(fSpeed);
  const [nx, ny, hit] = collideCircle(city, car.x, car.y, car.len * 0.36);
  if (hit) {
    car.x = nx;
    car.y = ny;
    // Kill the velocity that points into the wall; keep a scrape of the rest.
    car.vx *= 0.25;
    car.vy *= 0.25;
    if (before > 120) return before;
  }
  return 0;
}

/** The island as one big box a boat must not climb: the ground square plus its sand rim. */
const LAND_BOX = { x: -SHORE, y: -SHORE, w: WORLD.w + SHORE * 2, h: WORLD.h + SHORE * 2 };

/**
 * Advance one boat by dt under {throttle, steer, handbrake}. Water physics: thrust
 * builds slowly, the hull slides wide in a turn, drag is heavy, and the shore is a
 * wall — a boat that meets the sand stops dead and reports the impact speed.
 */
export function stepBoat(boat, control, dt) {
  const fx = Math.cos(boat.angle);
  const fy = Math.sin(boat.angle);
  let fSpeed = boat.vx * fx + boat.vy * fy;
  let lSpeed = boat.vx * -fy + boat.vy * fx;

  if (control.throttle > 0) fSpeed += boat.accel * control.throttle * dt * (fSpeed < 0 ? 2 : 1);
  else if (control.throttle < 0) fSpeed += boat.accel * control.throttle * dt * (fSpeed > 0 ? 2 : 0.5);
  fSpeed -= fSpeed * 0.62 * dt; // water drag
  if (control.handbrake) fSpeed -= fSpeed * 1.8 * dt; // chopping the throttle to a crawl
  fSpeed = clamp(fSpeed, -boat.topSpeed * 0.3, boat.topSpeed);

  const steerAuthority = clamp(Math.abs(fSpeed) / 110, 0, 1) * Math.sign(fSpeed);
  boat.angle += control.steer * 1.05 * steerAuthority * dt;

  lSpeed -= lSpeed * Math.min(1, 2.1 * dt); // a hull keeps its slide far longer than a tyre does

  const nfx = Math.cos(boat.angle);
  const nfy = Math.sin(boat.angle);
  boat.vx = nfx * fSpeed + -nfy * lSpeed;
  boat.vy = nfy * fSpeed + nfx * lSpeed;
  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;

  const r = boat.len * 0.38;
  const before = Math.abs(fSpeed);
  if (circleBoxOverlap(boat.x, boat.y, r, LAND_BOX) > 0) {
    const [nx, ny] = pushCircleOutOfBox(boat.x, boat.y, r, LAND_BOX);
    boat.x = nx;
    boat.y = ny;
    boat.vx *= 0.15;
    boat.vy *= 0.15;
    if (before > 110) return before;
  }
  return 0;
}

/**
 * Separate every pair of overlapping boats with a soft shove; a hard meeting of
 * hulls damages both and calls `onCrash(a, b, strength)`.
 */
export function collideBoats(boats, onCrash) {
  for (let i = 0; i < boats.length; i += 1) {
    const a = boats[i];
    for (let j = i + 1; j < boats.length; j += 1) {
      const b = boats[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = (a.len + b.len) * 0.36;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      const closing = (a.vx - b.vx) * ux + (a.vy - b.vy) * uy;
      if (closing > 60) {
        const damage = (closing - 60) * 0.08;
        a.hp -= damage;
        b.hp -= damage;
        onCrash(a, b, closing);
      }
      const swap = closing * 0.3;
      a.vx -= ux * swap;
      a.vy -= uy * swap;
      b.vx += ux * swap;
      b.vy += uy * swap;
    }
  }
}

/**
 * Separate every pair of overlapping cars with a soft impulse, damaging both when the
 * closing speed is high. `onCrash(a, b, strength)` hears about real impacts.
 */
export function collideCars(cars, onCrash) {
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = (a.len + b.len) * 0.34;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      const closing = (a.vx - b.vx) * ux + (a.vy - b.vy) * uy;
      if (closing > 40) {
        const damage = (closing - 40) * 0.09;
        a.hp -= damage;
        b.hp -= damage;
        onCrash(a, b, closing);
      }
      // Exchange a little velocity so cars shove rather than tunnel.
      const swap = closing * 0.32;
      a.vx -= ux * swap;
      a.vy -= uy * swap;
      b.vx += ux * swap;
      b.vy += uy * swap;
    }
  }
}

/** Move the player on foot; returns true while he is actually moving. */
export function stepPlayerOnFoot(player, axes, sprint, dt, city) {
  const mag = Math.hypot(axes.x, axes.y);
  player.moving = mag > 0.01;
  if (!player.moving) return false;
  const speed = sprint ? 268 : 192;
  player.x += (axes.x / mag) * speed * dt;
  player.y += (axes.y / mag) * speed * dt;
  const [nx, ny] = collideCircle(city, player.x, player.y, player.radius);
  player.x = nx;
  player.y = ny;
  player.walkCycle += dt * (sprint ? 11 : 8);
  return true;
}
