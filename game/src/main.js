// Neon Tide — boot and the one loop. The world advances in fixed 1/60 s steps;
// screens (title, play, pause, knocked out) decide what a step does and what is
// painted. Everything the systems need from each other travels on one object, G:
// the city, the player, the traffic, the law, the money and Vera's jobs.
//
// ?seed=N fixes the city. ?shot=title|drive|chase|mission (with &seed=N) stages a
// deterministic scene for a screenshot and sets window.__shotReady when painted.

import { HEAT, STEP, WORLD } from './config.js';
import { createRng } from './rng.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createCar, createPed, createPlayer, collideCars, forwardSpeed, stepCar, stepPlayerOnFoot } from './entities.js';
import { createFx } from './fx.js';
import { createRenderer } from './render.js';
import { drawDown, drawHud, drawPause, drawTitle } from './hud.js';
import { createDirector } from './missions.js';
import { managePeds, manageTraffic, scarePeds, updateFootCop, updatePed, updatePolice, updatePoliceCar, updateTrafficCar } from './ai.js';
import { updateBullets, updateCarPedHits, updateCopFire, updatePlayerGun } from './combat.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { arrangeShotScene, shotControl } from './shots.js';
import { clamp, dist } from './util.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const bootSeed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/** How dark the lamps think it is, 0 at noon to 1 at midnight. */
function nightAmountFor(hour) {
  if (hour >= 7.5 && hour <= 17.5) return 0;
  if (hour >= 19.5 || hour < 5.5) return 1;
  if (hour > 17.5) return (hour - 17.5) / 2;
  return (7.5 - hour) / 2;
}

/** Build a whole world: a fresh one, or one resumed from a save. */
function buildWorld(save) {
  const rng = createRng(bootSeed);
  const city = createCity(rng);
  const start = save !== null && save.x !== undefined ? { x: save.x, y: save.y } : { x: city.places.home.x, y: city.places.home.y - 30 };
  const player = createPlayer(start.x, start.y);
  const G = {
    rng,
    city,
    player,
    cars: [],
    peds: [],
    bullets: [],
    fx: createFx(),
    audio,
    time: 0,
    dayHour: 10.4,
    nightAmount: 0,
    camera: { x: player.x, y: player.y },
    wanted: { heat: 0, stars: 0, unseenT: 0, seen: false },
    cash: save !== null ? save.cash : 120,
    threat: { x: -9999, y: -9999 },
    spawnT: 0,
    pedT: 0,
    policeT: 0,
    prompt: null,
    downFee: 0,
    director: null,

    addHeat(amount) {
      this.wanted.heat = clamp(this.wanted.heat + amount, 0, 500);
    },
    addCash(amount) {
      this.cash += amount;
    },
    /** A crime the city notices: heat now, sirens soon. */
    crime(kind, x, y) {
      this.addHeat(HEAT[kind] ?? 20);
      scarePeds(this, x, y, 190);
    },
    onGunFired(x, y) {
      scarePeds(this, x, y, 260);
      // Heard by any officer nearby? Then it counts.
      for (const car of this.cars) {
        if (car.driver === 'police' && dist(car.x, car.y, x, y) < 520) {
          this.addHeat(HEAT.gunshotHeard);
          return;
        }
      }
      for (const ped of this.peds) {
        if (ped.role === 'cop' && dist(ped.x, ped.y, x, y) < 420) {
          this.addHeat(HEAT.gunshotHeard);
          return;
        }
      }
    },
    onCarHitWall(car, impact) {
      car.hp -= impact * 0.055;
      this.fx.sparks(car.x, car.y, Math.min(14, Math.floor(impact / 30)));
      if (car.driver === 'player') {
        this.fx.addShake(impact / 55);
        audio.crash(impact / 500);
      }
    },
    onMissionComplete() {
      saveGame();
    },
  };
  // The parked cars of Port Azura: most of the spots the city reserved.
  for (const spot of city.parkedSpots) {
    if (rng.chance(0.28)) continue;
    const car = createCar(rng.pick(['sedan', 'hatch', 'sedan', 'taxi', 'van']), spot.x, spot.y, spot.angle, null, rng);
    G.cars.push(car);
  }
  G.director = createDirector(city, rng, save !== null ? save.missionIndex : 0);
  return G;
}

let G = buildWorld(null);
let screen = 'title';
let downT = 0;
let notice = null;
let noticeT = 0;

function saveGame() {
  if (G.director.storyDone && G.cash === 120) return;
  writeSave({ cash: Math.floor(G.cash), missionIndex: G.director.missionIndex, x: Math.round(G.player.x), y: Math.round(G.player.y) });
}

function announce(message) {
  if (status !== null) status.textContent = message;
}

/** The car the player could get into, if any: nearest, alive, within reach. */
function nearestEnterableCar() {
  const p = G.player;
  let best = null;
  let bestD = 56;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // The driver bails out and runs: a theft, witnessed by the whole street.
    G.crime('carjack', car.x, car.y);
    G.fx.text(car.x, car.y - 30, 'STOLEN', '#ff9a3d');
    const ped = createPed(G.rng, car.x + 20, car.y + 14, 'walker');
    ped.panicT = 2.6;
    G.threat = { x: car.x, y: car.y };
    G.peds.push(ped);
  } else if (car.driver === 'police') {
    G.crime('hitPolice', car.x, car.y);
  }
  car.driver = 'player';
  p.car = car;
  audio.unlock();
}

function exitCar() {
  const p = G.player;
  const car = p.car;
  if (car === null) return;
  car.driver = 'parked';
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * (car.wid / 2 + 16);
  p.y = car.y + Math.sin(side) * (car.wid / 2 + 16);
  p.car = null;
}

/** One fixed step of the living world (used in play, and behind the title). */
function stepWorld(dt, control) {
  const p = G.player;
  G.time += dt;
  G.dayHour = (G.dayHour + dt * (24 / 480)) % 24;
  G.nightAmount = nightAmountFor(G.dayHour);
  p.hurtT = Math.max(0, p.hurtT - dt);

  // --- the player, afoot or driving
  if (p.car !== null) {
    const car = p.car;
    const impact = stepCar(car, { throttle: control.throttle, steer: control.steer, handbrake: control.handbrake }, dt, G.city);
    if (impact > 0) G.onCarHitWall(car, impact);
    p.x = car.x;
    p.y = car.y;
    // Tyre marks and smoke from a hard-worked car.
    const speed = Math.abs(forwardSpeed(car));
    const lateral = Math.abs(car.vx * -Math.sin(car.angle) + car.vy * Math.cos(car.angle));
    if ((lateral > 95 && speed > 130) || (control.handbrake && speed > 170)) {
      const bx = car.x - Math.cos(car.angle) * car.len * 0.32;
      const by = car.y - Math.sin(car.angle) * car.len * 0.32;
      const px = -Math.sin(car.angle);
      const py = Math.cos(car.angle);
      if (car.ai.lastSkid !== undefined) {
        G.fx.skid(car.ai.lastSkid.lx, car.ai.lastSkid.ly, bx + px * car.wid * 0.4, by + py * car.wid * 0.4);
        G.fx.skid(car.ai.lastSkid.rx, car.ai.lastSkid.ry, bx - px * car.wid * 0.4, by - py * car.wid * 0.4);
      }
      car.ai.lastSkid = { lx: bx + px * car.wid * 0.4, ly: by + py * car.wid * 0.4, rx: bx - px * car.wid * 0.4, ry: by - py * car.wid * 0.4 };
    } else car.ai.lastSkid = undefined;
    if (car.hp < car.maxHp * 0.35 && Math.random() < dt * 7) {
      G.fx.smoke(car.x + Math.cos(car.angle) * car.len * 0.4, car.y + Math.sin(car.angle) * car.len * 0.4, 1, car.hp < car.maxHp * 0.16);
    }
  } else {
    stepPlayerOnFoot(p, control.axes, control.sprint, dt, G.city);
    if (control.axes.x !== 0 || control.axes.y !== 0) {
      // Aiming follows the mouse; walking turns him the way he walks until he aims.
      if (!control.pointer.down) p.angle = Math.atan2(control.axes.y, control.axes.x);
    }
    if (control.pointer.down || p.fireCd > -0.6) {
      p.angle = Math.atan2(control.pointer.wy - p.y, control.pointer.wx - p.x);
    }
    updatePlayerGun(G, dt, control.pointer, control.reload);
  }

  // --- the city around him
  manageTraffic(G, dt);
  managePeds(G, dt);
  for (const car of G.cars) {
    if (car.driver === 'traffic' && !car.wrecked) updateTrafficCar(G, car, dt);
    else if (car.driver === 'police') updatePoliceCar(G, car, dt);
  }
  for (const ped of G.peds) {
    if (ped.role === 'cop') updateFootCop(G, ped, dt);
    else updatePed(G, ped, dt);
  }
  collideCars(G.cars, (a, b, closing) => {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    G.fx.sparks(midX, midY, Math.min(12, Math.floor(closing / 26)));
    if (a.driver === 'player' || b.driver === 'player') {
      G.fx.addShake(closing / 60);
      audio.crash(closing / 480);
      const other = a.driver === 'player' ? b : a;
      // Only a real hit is a crime; a grinding scrape while boxed in is not.
      if (closing > 150) {
        if (other.driver === 'police') G.crime('hitPolice', midX, midY);
        else if (other.driver === 'traffic') G.crime('hitCar', midX, midY);
      }
    }
  });
  updateCarPedHits(G);
  updateCopFire(G);
  updateBullets(G, dt);
  updatePolice(G, dt);
  G.director.update(G, dt, control.confirm);
  G.fx.update(dt);

  // Wrecks: a car at zero health dies where it stands.
  for (const car of G.cars) {
    if (car.hp <= 0 && !car.wrecked) {
      car.wrecked = true;
      car.vx = 0;
      car.vy = 0;
      G.fx.smoke(car.x, car.y, 10, true);
      if (p.car === car) {
        exitCar();
        p.hp -= 8;
        G.fx.text(p.x, p.y - 30, 'WRECKED', '#ff6b5e');
      }
    }
  }

  // Camera and sound follow the action.
  const focus = p.car !== null ? p.car : p;
  const lead = p.car !== null ? 0.34 : 0;
  const tx = focus.x + focus.vx * lead;
  const ty = focus.y + focus.vy * lead;
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5.5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5.5);
  G.camera.x = clamp(G.camera.x, canvas.width / 2 - 260, WORLD.w - canvas.width / 2 + 260);
  G.camera.y = clamp(G.camera.y, canvas.height / 2 - 260, WORLD.h - canvas.height / 2 + 260);
  const engineAmount = p.car !== null ? Math.abs(forwardSpeed(p.car)) / p.car.topSpeed : 0;
  audio.engine(engineAmount);
  let siren = 0;
  for (const car of G.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 560) siren = Math.max(siren, 1 - d / 560);
  }
  audio.siren(siren);

  // The context prompt.
  if (p.car !== null) G.prompt = `E — Exit the ${p.car.name}`;
  else {
    const car = nearestEnterableCar();
    G.prompt = car !== null ? `E — ${car.driver === 'traffic' ? 'Steal' : 'Enter'} the ${car.name}` : null;
  }

  if (p.hp <= 0 && screen === 'play') {
    screen = 'down';
    downT = 3;
    G.downFee = Math.min(Math.floor(G.cash), 150 + G.wanted.stars * 40);
    G.cash -= G.downFee;
    announce('Knocked out. You wake at the hospital.');
  }
}

/** Read the real input into the control shape stepWorld eats. */
function readControl(actions) {
  const pointer = input.pointer();
  return {
    axes: input.moveAxes(),
    throttle: input.throttle(),
    steer: input.steer(),
    handbrake: input.handbrake(),
    sprint: input.sprint(),
    pointer: {
      down: pointer.down,
      wx: pointer.x + G.camera.x - canvas.width / 2,
      wy: pointer.y + G.camera.y - canvas.height / 2,
    },
    reload: (actions & ACTION_RELOAD) !== 0,
    confirm: (actions & ACTION_CONFIRM) !== 0,
  };
}

const IDLE_CONTROL = {
  axes: { x: 0, y: 0 },
  throttle: 0,
  steer: 0,
  handbrake: false,
  sprint: false,
  pointer: { down: false, wx: 0, wy: 0 },
  reload: false,
  confirm: false,
};

function respawn() {
  const p = G.player;
  if (p.car !== null) {
    p.car.driver = 'parked';
    p.car = null;
  }
  p.x = G.city.places.hospital.x;
  p.y = G.city.places.hospital.y - 24;
  p.hp = p.maxHp;
  p.mag = p.magSize;
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.camera.x = p.x;
  G.camera.y = p.y;
  screen = 'play';
}

function handlePlayActions(actions) {
  if ((actions & ACTION_PAUSE) !== 0) {
    screen = 'pause';
    notice = null;
    return;
  }
  if ((actions & ACTION_INTERACT) !== 0) {
    if (G.player.car !== null) exitCar();
    else {
      const car = nearestEnterableCar();
      if (car !== null) enterCar(car);
    }
  }
}

function frame() {
  const actions = input.takeActions();
  if ((actions & ACTION_MUTE) !== 0) audio.toggleMute();
  if (actions !== 0) audio.unlock();

  if (screen === 'title') {
    // The city lives behind the title; the camera drifts over downtown.
    G.time += STEP;
    G.camera.x = WORLD.w / 2 + Math.sin(G.time * 0.05) * 620;
    G.camera.y = WORLD.h / 2 + Math.cos(G.time * 0.037) * 520;
    manageTraffic(G, STEP);
    managePeds(G, STEP);
    for (const car of G.cars) if (car.driver === 'traffic') updateTrafficCar(G, car, STEP);
    for (const ped of G.peds) updatePed(G, ped, STEP);
    G.fx.update(STEP);
    if ((actions & ACTION_CONFIRM) !== 0) {
      const save = loadSave();
      G = buildWorld(save);
      screen = 'play';
      announce(save !== null ? 'Welcome back to Port Azura.' : 'A new story in Port Azura.');
    } else if (input.down('KeyN')) {
      clearSave();
      G = buildWorld(null);
      screen = 'play';
      announce('A new story in Port Azura.');
    }
  } else if (screen === 'play') {
    handlePlayActions(actions);
    if (screen === 'play') stepWorld(STEP, readControl(actions));
  } else if (screen === 'pause') {
    if ((actions & ACTION_PAUSE) !== 0 || (actions & ACTION_CONFIRM) !== 0) screen = 'play';
    else if (input.down('KeyS')) {
      saveGame();
      notice = 'Saved.';
      noticeT = 1.6;
    } else if (input.down('Backspace')) {
      clearSave();
      G = buildWorld(null);
      screen = 'play';
    }
  } else if (screen === 'down') {
    downT -= STEP;
    G.fx.update(STEP);
    if (downT <= 0) respawn();
  }
  if (noticeT > 0) {
    noticeT -= STEP;
    if (noticeT <= 0) notice = null;
  }

  renderer.draw(G);
  const ctx = renderer.ctx;
  if (screen === 'play') drawHud(ctx, G, canvas.width, canvas.height, G.prompt);
  else if (screen === 'title') drawTitle(ctx, G, canvas.width, canvas.height, loadSave() !== null, null);
  else if (screen === 'pause') {
    drawHud(ctx, G, canvas.width, canvas.height, null);
    drawPause(ctx, G, canvas.width, canvas.height, notice);
  } else if (screen === 'down') drawDown(ctx, G, canvas.width, canvas.height, G.downFee);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- screenshots

function runShot(name) {
  G = buildWorld(null);
  screen = 'play';
  arrangeShotScene(name, G);
  const control = shotControl(name, G);
  const steps = name === 'title' ? 0 : name === 'chase' ? 150 : 210;
  for (let i = 0; i < steps; i += 1) stepWorld(STEP, control(i * STEP));
  if (name === 'title') screen = 'title';
  let painted = 0;
  function paint() {
    // In shot mode the camera the scene arranged is the camera we keep.
    renderer.draw(G);
    const ctx = renderer.ctx;
    if (name === 'title') drawTitle(ctx, G, canvas.width, canvas.height, false, null);
    else drawHud(ctx, G, canvas.width, canvas.height, G.prompt);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shotName !== null) runShot(shotName);
else requestAnimationFrame(frame);

// A small window onto the game for the maker's own testing tools (and curious players
// with a console): the live world object and the current screen, read-only by habit.
window.__neonTide = {
  get world() {
    return G;
  },
  get screen() {
    return screen;
  },
};
