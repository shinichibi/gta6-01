// The staged scenes behind ?shot=title|night|boat|combat. Each arranges a real
// world (built by main.js from the same seed) into a moment worth photographing —
// dusk over the neon strip for the cover, a two-star night chase, a skiff planing
// along the shore at golden hour, a shootout on foot — then drives it with a small
// scripted control so the frame is a game really being played.

import { LANE_OFF, ROADS, WORLD, nightAmountFor } from './config.js';
import { createBoat, createCar, createPed } from './entities.js';
import { clamp } from './util.js';

const IDLE = {
  axes: { x: 0, y: 0 },
  throttle: 0,
  steer: 0,
  handbrake: false,
  sprint: false,
  pointer: { down: false, wx: 0, wy: 0 },
  reload: false,
  confirm: false,
};

/** Steer a shot car along a horizontal lane: full throttle, gentle corrections. */
function laneControl(car, laneY, weave = 0) {
  return (t) => {
    const targetY = laneY + Math.sin(t * 1.7) * weave;
    const want = Math.atan2(targetY - car.y, 520);
    let delta = want - car.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return { ...IDLE, throttle: 1, steer: clamp(delta * 2.6, -1, 1) };
  };
}

/** Hold a shot boat on a heading along the shore, correcting toward a line of latitude. */
function boatControl(boat, lineY) {
  return () => {
    const want = Math.atan2(lineY - boat.y, 620);
    let delta = want - boat.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return { ...IDLE, throttle: 1, steer: clamp(delta * 2.2, -1, 1) };
  };
}

/** The story is finished in the staged worlds; Vera's jobs are done, the city is open. */
function finishStory(D) {
  D.missionIndex = D.missions.length;
  D.storyDone = true;
  D.introQueuedFor = D.missions.length;
  D.stageSetupPending = false;
  D.taxi.cooldownT = 9999; // no fare flags a cab in a photograph
}

/** Put the world into the named scene. Called once, before the steps run. */
export function arrangeShotScene(name, G) {
  const D = G.director;
  G.dayHour = 15.3;
  if (name === 'title') {
    // The cover: dusk on the neon strip, a Comet at the kerb, the city lighting up.
    G.dayHour = 18.55;
    G.nightAmount = nightAmountFor(G.dayHour);
    G.cash = 2350;
    finishStory(D);
    const car = createCar('sports', ROADS[3] + 30, ROADS[3] + LANE_OFF, 0, '#d92b2b', G.rng);
    car.driver = 'player';
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    const company = [
      ['taxi', ROADS[3] - 330, ROADS[3] - LANE_OFF, Math.PI],
      ['sedan', ROADS[3] + 420, ROADS[3] - LANE_OFF, Math.PI],
      ['pickup', ROADS[2] + LANE_OFF, ROADS[3] + 330, Math.PI / 2],
    ];
    for (const [type, x, y, angle] of company) {
      const other = createCar(type, x, y, angle, null, G.rng);
      other.driver = 'traffic';
      other.ai.node = [3, 3];
      G.cars.push(other);
    }
    for (const [x, y] of [[ROADS[3] - 120, ROADS[3] - 76], [ROADS[3] + 190, ROADS[3] + 76], [ROADS[3] + 90, ROADS[3] - 76]]) {
      const ped = createPed(G.rng, x, y, 'walker');
      G.peds.push(ped);
    }
    G.camera.x = car.x;
    G.camera.y = car.y;
    return;
  }
  if (name === 'night') {
    // Two stars on the neon strip at midnight: headlights, strobes, wet-looking light.
    G.dayHour = 23.15;
    G.nightAmount = nightAmountFor(G.dayHour);
    G.cash = 1875;
    finishStory(D);
    G.addHeat(215);
    const car = createCar('sports', ROADS[1] + 40, ROADS[3] + LANE_OFF, 0, '#3d7bd9', G.rng);
    car.driver = 'player';
    car.vx = 380;
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    const hunters = [
      [car.x - 150, car.y - 6, 0, 380],
      [car.x - 300, car.y + 26, 0, 380],
      [car.x + 520, ROADS[3] - LANE_OFF, Math.PI, -330],
    ];
    for (const [x, y, angle, vx] of hunters) {
      const cop = createCar('police', x, y, angle, null, G.rng);
      cop.driver = 'police';
      cop.vx = vx;
      G.cars.push(cop);
    }
    const ahead = createCar('taxi', car.x + 430, ROADS[3] - LANE_OFF, Math.PI, null, G.rng);
    ahead.driver = 'traffic';
    ahead.ai.node = [2, 3];
    G.cars.push(ahead);
    G.camera.x = car.x;
    G.camera.y = car.y;
    return;
  }
  if (name === 'boat') {
    // Golden hour on the water: a skiff planing east along the shore, wake behind.
    G.dayHour = 17.9;
    G.nightAmount = nightAmountFor(G.dayHour);
    G.cash = 1640;
    finishStory(D);
    const boat = G.boats.find((b) => b.driver === 'docked');
    boat.driver = 'player';
    boat.x = 260;
    boat.y = WORLD.h + 150;
    boat.angle = 0.12;
    G.player.boat = boat;
    G.player.x = boat.x;
    G.player.y = boat.y;
    // The Sirena at anchor nearby, riding the same golden water.
    const yacht = createBoat('yacht', 1560, WORLD.h + 330, -0.4, '#f2f0e6', G.rng);
    yacht.driver = 'anchored';
    G.boats.push(yacht);
    G.camera.x = boat.x;
    G.camera.y = boat.y;
    return;
  }
  if (name === 'combat') {
    // A shootout on foot at the big crossroads: three stars, two officers returning
    // fire across the open asphalt, Jax mid-magazine with Vera's SMG in hand.
    G.dayHour = 14.6;
    G.nightAmount = nightAmountFor(G.dayHour);
    G.cash = 980;
    finishStory(D);
    G.addHeat(320);
    G.player.x = ROADS[3] - 120;
    G.player.y = ROADS[3] + 40;
    G.player.angle = 0;
    G.player.hasSmg = true;
    G.player.weapon = 'smg';
    G.player.mag = 30;
    G.player.magSize = 30;
    G.player.reserve = 150;
    const ride = createCar('sports', ROADS[3] - 210, ROADS[3] + LANE_OFF + 36, 0.2, '#d92b2b', G.rng);
    G.cars.push(ride);
    const patrol = createCar('police', ROADS[3] + 300, ROADS[3] - LANE_OFF, Math.PI, null, G.rng);
    G.cars.push(patrol);
    const copA = createPed(G.rng, ROADS[3] + 175, ROADS[3] + 52, 'cop');
    copA.car = patrol;
    const copB = createPed(G.rng, ROADS[3] + 90, ROADS[3] - 84, 'cop');
    copB.car = patrol;
    G.peds.push(copA, copB);
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    return;
  }
  // Unknown names fall back to the combat scene's busy street.
  arrangeShotScene('combat', G);
}

/** The scripted control for a scene: a function of elapsed seconds. */
export function shotControl(name, G) {
  if (name === 'title') return () => IDLE;
  if (name === 'night') {
    const car = G.player.car;
    return laneControl(car, ROADS[3] + LANE_OFF, 10);
  }
  if (name === 'boat') {
    const boat = G.player.boat;
    return boatControl(boat, WORLD.h + 150);
  }
  if (name === 'combat') {
    // Jax keeps firing at the nearest standing officer; the officers answer.
    return () => {
      const cop = G.peds.find((ped) => ped.role === 'cop' && !ped.dead);
      return {
        ...IDLE,
        pointer: { down: true, wx: cop !== undefined ? cop.x : G.player.x + 120, wy: cop !== undefined ? cop.y : G.player.y },
      };
    };
  }
  return () => IDLE;
}
