// The people and machines of Port Azura: the player, every car (one physics model
// shared by the player's driving, traffic and the police), and pedestrians.
// Controllers live in ai.js; this file owns shapes, stats and movement physics.

import { CAR_COLORS } from './config.js';
import { collideCircle } from './city.js';
import { clamp } from './util.js';

/** Car models: size, pace and toughness. `name` is what the HUD calls them. */
export const CAR_TYPES = {
  sedan: { name: 'Marina Sedan', len: 46, wid: 22, topSpeed: 470, accel: 370, hp: 120 },
  hatch: { name: 'Pico Hatch', len: 42, wid: 21, topSpeed: 435, accel: 350, hp: 100 },
  sports: { name: 'Comet GT', len: 48, wid: 22, topSpeed: 645, accel: 500, hp: 110 },
  taxi: { name: 'City Cab', len: 46, wid: 22, topSpeed: 460, accel: 360, hp: 120 },
  van: { name: 'Bastion Van', len: 58, wid: 27, topSpeed: 395, accel: 300, hp: 260 },
  police: { name: 'Azura PD Interceptor', len: 47, wid: 23, topSpeed: 560, accel: 460, hp: 170 },
};

/** The player: Jax Marlowe, wheelman. On foot until `car` names the one he drives. */
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
    walkCycle: 0,
    moving: false,
    fireCd: 0,
    mag: 12,
    magSize: 12,
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
    sirenPhase: rng.range(0, 6),
  };
}

/** A pedestrian. Roles: 'walker' on the pavements, 'cop' on foot patrol, 'client' waiting for a ride. */
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
    walkSpeed: rng.range(52, 78),
    shirt: role === 'cop' ? '#2c4a7c' : rng.pick(['#e86a5a', '#5ab0e8', '#f2e3c6', '#7fc96b', '#e8b7c8', '#f2b63d', '#fdf6ec', '#63c7b2']),
    skin: rng.pick(['#f2c79b', '#c68863', '#8a5a3b', '#ffdbb4', '#6e452a']),
    state: 'walk',
    // Pavement walking: along one axis on one pavement line, turning at junctions.
    axis: rng.chance(0.5) ? 'v' : 'h',
    dir: rng.chance(0.5) ? 1 : -1,
    panicT: 0,
    downT: 0,
    shootCd: rng.range(0.4, 1.2),
    car: null, // the police car a foot cop came from
    dead: false,
  };
}

/** Forward speed of a car along its nose (negative when reversing). */
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
