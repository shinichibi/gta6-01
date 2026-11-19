// Guns and consequences: the player's two guns (pistol and Vera's Kite SMG),
// officers returning fire, bullets against cars, boats, people and walls, and what
// a fast car does to a slow pedestrian.

import { HEAT, WEAPON_ORDER, WEAPONS } from './config.js';
import { lineBlocked } from './ai.js';
import { dist } from './util.js';

const BULLET_SPEED = 1450;
const COP_DAMAGE = 7;

/** Fire one bullet; `from` is 'player' or 'cop'. Spread is in radians. */
export function spawnBullet(G, x, y, angle, from, spread = 0, damage = WEAPONS.pistol.damage) {
  const a = angle + (Math.random() - 0.5) * spread;
  G.bullets.push({ x, y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: 0.55, from, dmg: damage });
  G.fx.muzzle(x, y, a);
}

/**
 * Swap to the other gun, keeping each weapon's own magazine and reserve. The SMG
 * only exists once Vera has handed it over; the swap is a small ceremony — no
 * swapping mid-reload.
 */
export function swapWeapon(G) {
  const p = G.player;
  if (!p.hasSmg || p.reloadT > 0) return;
  p.ammo[p.weapon] = { mag: p.mag, reserve: p.reserve };
  const idx = WEAPON_ORDER.indexOf(p.weapon);
  p.weapon = WEAPON_ORDER[(idx + 1) % WEAPON_ORDER.length];
  p.mag = p.ammo[p.weapon].mag;
  p.reserve = p.ammo[p.weapon].reserve;
  p.magSize = WEAPONS[p.weapon].magSize;
  p.fireCd = Math.max(p.fireCd, 0.22);
  G.audio.swap();
}

/**
 * The player's gun, driven by the loop: hold the mouse to fire, R (or an empty
 * magazine) to reload. Works on foot and from a boat's deck — never from a car.
 * Sounds and crime go through G's hooks.
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
  const spec = WEAPONS[p.weapon];
  p.fireCd = spec.rate;
  p.mag -= 1;
  const angle = Math.atan2(pointer.wy - p.y, pointer.wx - p.x);
  p.angle = angle;
  const mx = p.x + Math.cos(angle) * 16;
  const my = p.y + Math.sin(angle) * 16;
  spawnBullet(G, mx, my, angle, 'player', spec.spread, spec.damage);
  G.fx.flash(mx, my, 74, '#ffca7a', 0.07);
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
    spawnBullet(G, ped.x + Math.cos(angle) * 14, ped.y + Math.sin(angle) * 14, angle, 'cop', 0.14, COP_DAMAGE);
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
          car.hp -= Math.max(3, Math.round(bullet.dmg * 0.2));
          car.flashT = 0.09;
          G.fx.sparks(bullet.x, bullet.y, 4);
          spent = true;
          break;
        }
      }
      if (!spent) {
        for (const boat of G.boats) {
          if (dist(bullet.x, bullet.y, boat.x, boat.y) < boat.len * 0.45) {
            boat.hp -= Math.max(3, Math.round(bullet.dmg * 0.2));
            boat.flashT = 0.09;
            G.fx.sparks(bullet.x, bullet.y, 4);
            spent = true;
            break;
          }
        }
      }
      if (!spent) {
        for (const ped of G.peds) {
          if (ped.dead || dist(bullet.x, bullet.y, ped.x, ped.y) > ped.radius + 3) continue;
          ped.hp -= bullet.dmg;
          ped.flashT = 0.09;
          G.fx.hitPuff(ped.x, ped.y);
          if (ped.hp <= 0) killPed(G, ped, true);
          else ped.panicT = Math.max(ped.panicT, 1.2);
          spent = true;
          break;
        }
      }
    }
    if (!spent && bullet.from === 'cop') {
      const target = p.car !== null ? p.car : p.boat !== null ? p.boat : p;
      const radius = p.car !== null ? p.car.len * 0.42 : p.boat !== null ? p.boat.len * 0.45 : p.radius + 3;
      if (dist(bullet.x, bullet.y, target.x, target.y) < radius) {
        if (p.car !== null) {
          p.car.hp -= 5;
          p.car.flashT = 0.09;
          G.fx.sparks(bullet.x, bullet.y, 4);
        } else if (p.boat !== null) {
          p.boat.hp -= 5;
          p.boat.flashT = 0.09;
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

/** Damage the player (on foot only; vehicle hits are handled as vehicle damage). */
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
