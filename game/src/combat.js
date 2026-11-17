// Guns and consequences: the player's pistol, officers returning fire, bullets
// against cars, people and walls, and what a fast car does to a slow pedestrian.

import { HEAT } from './config.js';
import { lineBlocked } from './ai.js';
import { dist } from './util.js';

const BULLET_SPEED = 1450;
const PLAYER_DAMAGE = 34;
const COP_DAMAGE = 7;

/** Fire one bullet; `from` is 'player' or 'cop'. Spread is in radians. */
export function spawnBullet(G, x, y, angle, from, spread = 0) {
  const a = angle + (Math.random() - 0.5) * spread;
  G.bullets.push({ x, y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: 0.55, from });
  G.fx.muzzle(x, y, a);
}

/**
 * The player's pistol, driven by the loop: hold the mouse to fire, R (or an empty
 * magazine) to reload. Returns nothing; sounds and crime go through G's hooks.
 */
export function updatePlayerGun(G, dt, pointer, wantReload) {
  const p = G.player;
  p.fireCd -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const take = Math.min(p.magSize - p.mag, p.reserve);
      p.mag += take;
      p.reserve -= take;
    }
    return;
  }
  if (wantReload && p.mag < p.magSize && p.reserve > 0) {
    p.reloadT = 1.1;
    return;
  }
  if (p.car !== null || !pointer.down) return;
  if (p.mag === 0) {
    if (p.reserve > 0) p.reloadT = 1.1;
    return;
  }
  if (p.fireCd > 0) return;
  p.fireCd = 0.13;
  p.mag -= 1;
  const angle = Math.atan2(pointer.wy - p.y, pointer.wx - p.x);
  p.angle = angle;
  spawnBullet(G, p.x + Math.cos(angle) * 16, p.y + Math.sin(angle) * 16, angle, 'player', 0.035);
  G.audio.gunshot();
  G.onGunFired(p.x, p.y);
}

/** Officers whose AI asked to fire (ai.js sets wantFire) shoot at the player now. */
export function updateCopFire(G) {
  for (const ped of G.peds) {
    if (!ped.wantFire) continue;
    ped.wantFire = false;
    if (ped.dead || ped.role !== 'cop') continue;
    const p = G.player;
    const angle = Math.atan2(p.y - ped.y, p.x - ped.x);
    spawnBullet(G, ped.x + Math.cos(angle) * 14, ped.y + Math.sin(angle) * 14, angle, 'cop', 0.14);
    G.audio.distantShot();
  }
}

/** Point-in-building test for a bullet's next step. */
function hitsWall(G, x, y) {
  for (const b of G.city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

/** Advance every bullet and apply what it runs into. */
export function updateBullets(G, dt) {
  const p = G.player;
  const kept = [];
  for (const bullet of G.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let spent = bullet.life <= 0;
    if (!spent && hitsWall(G, bullet.x, bullet.y)) {
      G.fx.sparks(bullet.x, bullet.y, 3);
      spent = true;
    }
    if (!spent && bullet.from === 'player') {
      for (const car of G.cars) {
        if (dist(bullet.x, bullet.y, car.x, car.y) < car.len * 0.42) {
          car.hp -= 6;
          G.fx.sparks(bullet.x, bullet.y, 4);
          spent = true;
          break;
        }
      }
      if (!spent) {
        for (const ped of G.peds) {
          if (ped.dead || dist(bullet.x, bullet.y, ped.x, ped.y) > ped.radius + 3) continue;
          ped.hp -= PLAYER_DAMAGE;
          G.fx.hitPuff(ped.x, ped.y);
          if (ped.hp <= 0) killPed(G, ped, true);
          else ped.panicT = Math.max(ped.panicT, 1.2);
          spent = true;
          break;
        }
      }
    }
    if (!spent && bullet.from === 'cop') {
      const target = p.car !== null ? p.car : p;
      const radius = p.car !== null ? p.car.len * 0.42 : p.radius + 3;
      if (dist(bullet.x, bullet.y, target.x, target.y) < radius) {
        if (p.car !== null) {
          p.car.hp -= 5;
          G.fx.sparks(bullet.x, bullet.y, 4);
        } else {
          hurtPlayer(G, COP_DAMAGE);
        }
        spent = true;
      }
    }
    if (!spent) kept.push(bullet);
  }
  G.bullets = kept;
}

/** A person falls. Player-caused deaths are crimes; a dead officer costs the most heat. */
export function killPed(G, ped, byPlayer) {
  ped.dead = true;
  ped.downT = 6;
  ped.hp = 0;
  if (byPlayer) {
    if (ped.role === 'cop') G.crime('killCop', ped.x, ped.y);
    else G.crime('killPed', ped.x, ped.y);
  }
}

/** Damage the player (on foot only; car hits are handled as car damage). */
export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.hp <= 0) return;
  p.hp -= amount;
  p.hurtT = 0.25;
  G.audio.hurt();
  G.fx.addShake(2.5);
}

/**
 * Cars versus people: a car moving fast into a pedestrian knocks them down.
 * The player's own driving is a crime the city notices; a police ram that
 * clips a walker is the city's problem, not the player's heat.
 */
export function updateCarPedHits(G) {
  for (const car of G.cars) {
    const speed = Math.hypot(car.vx, car.vy);
    if (speed < 130) continue;
    for (const ped of G.peds) {
      if (ped.dead || ped.role === 'client') continue;
      if (dist(car.x, car.y, ped.x, ped.y) > car.len * 0.42 + ped.radius) continue;
      ped.hp = 0;
      killPed(G, ped, car.driver === 'player');
      G.fx.hitPuff(ped.x, ped.y);
      G.fx.addShake(car.driver === 'player' ? 4 : 1.5);
      if (car.driver === 'player') G.crime('runOverPed', ped.x, ped.y);
    }
  }
}

/** Is the player's gun line to a point clear? (Used for the aim indicator.) */
export function hasLineOfSight(G, x, y) {
  return !lineBlocked(G.city, G.player.x, G.player.y, x, y);
}

export { HEAT };
