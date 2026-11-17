// The staged scenes behind ?shot=title|drive|chase|mission. Each arranges a real
// world (built by main.js from the same seed) into a moment worth photographing —
// a drive across town mid-job, a three-star chase, Vera's first call — then drives
// it with a small scripted control so the frame is a game really being played.

import { LANE_OFF, ROADS } from './config.js';
import { createCar, createPed } from './entities.js';
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

/** Put the world into the named scene. Called once, before the steps run. */
export function arrangeShotScene(name, G) {
  const D = G.director;
  G.dayHour = 15.3;
  if (name === 'title') {
    G.camera.x = 1760;
    G.camera.y = 1470;
    return;
  }
  if (name === 'drive') {
    // Mid Package Run: the package is aboard, the garage is across town, cash is real.
    G.cash = 640;
    D.missionIndex = 1;
    D.introQueuedFor = 1;
    D.stageIndex = 1;
    D.stageSetupPending = false;
    D.timerLeft = 132;
    const car = createCar('sedan', ROADS[3] - 200, ROADS[3] + LANE_OFF, 0, '#3d7bd9', G.rng);
    car.driver = 'player';
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    // Company on the road: traffic on the same avenue and the crossing one.
    const company = [
      ['hatch', ROADS[3] + 330, ROADS[3] - LANE_OFF, Math.PI],
      ['taxi', ROADS[3] + 60, ROADS[3] - LANE_OFF, Math.PI],
      ['sedan', ROADS[4] - LANE_OFF, ROADS[3] - 260, Math.PI / 2],
      ['van', ROADS[3] - 480, ROADS[3] + LANE_OFF, 0],
    ];
    for (const [type, x, y, angle] of company) {
      const other = createCar(type, x, y, angle, null, G.rng);
      other.driver = 'traffic';
      other.ai.node = [3, 3];
      G.cars.push(other);
    }
    G.camera.x = car.x;
    G.camera.y = car.y;
    return;
  }
  if (name === 'chase') {
    // The Comet run, gone loud: three stars, interceptors converging, none landed yet.
    G.cash = 1875;
    G.dayHour = 16.9;
    G.addHeat(215);
    D.missionIndex = 3;
    D.introQueuedFor = 3;
    D.stageIndex = 1;
    D.stageSetupPending = false;
    const car = createCar('sports', 1250, ROADS[4] + LANE_OFF, 0, '#d92b2b', G.rng);
    car.missionCar = true;
    car.driver = 'player';
    car.vx = 400;
    D.stageCar = car;
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    const hunters = [
      [car.x - 215, car.y - 4, 0],
      [car.x - 370, car.y + 24, 0],
      [car.x + 460, ROADS[4] - LANE_OFF, Math.PI],
    ];
    for (const [x, y, angle] of hunters) {
      const cop = createCar('police', x, y, angle, null, G.rng);
      cop.driver = 'police';
      cop.vx = Math.cos(angle) * 330;
      G.cars.push(cop);
    }
    const officer = createPed(G.rng, car.x + 330, car.y - 96, 'cop');
    G.peds.push(officer);
    G.camera.x = car.x;
    G.camera.y = car.y;
    return;
  }
  if (name === 'mission') {
    // The first morning: Vera on the phone, her teal sedan waiting with its gold ring.
    G.dayHour = 11.1;
    D.introQueuedFor = 0;
    D.queueDialogue(D.currentMission().intro);
    const stage = D.currentStage();
    if (stage !== null && stage.setup !== undefined) stage.setup(G, D);
    D.stageSetupPending = false;
    G.camera.x = G.player.x;
    G.camera.y = G.player.y;
    return;
  }
  // Unknown names fall back to the mission scene's quiet street.
  arrangeShotScene('mission', G);
}

/** The scripted control for a scene: a function of elapsed seconds. */
export function shotControl(name, G) {
  if (name === 'drive') {
    const car = G.player.car;
    return laneControl(car, ROADS[3] + LANE_OFF, 4);
  }
  if (name === 'chase') {
    const car = G.player.car;
    return laneControl(car, ROADS[4] + LANE_OFF, 16);
  }
  return () => IDLE;
}
