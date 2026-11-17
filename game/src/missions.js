// The story of Neon Tide, run as a director: seven jobs for the fixer Vera Castellan,
// told over the phone, each a short chain of stages (go here, take that car, lose the
// police, deliver). Between and after the jobs, cab fares pay the rent. The director
// owns objectives, markers, timers and dialogue; the loop owns everything else.

import { ROADS } from './config.js';
import { createCar, createPed } from './entities.js';
import { dist } from './util.js';

const VERA = 'VERA';
const JAX = 'JAX';

/** A stage the player finishes by arriving somewhere. opts.need: 'foot' | 'any' | 'car' | 'stageCar'. */
function reachStage(text, at, r, opts = {}) {
  return {
    text,
    at,
    r,
    need: opts.need ?? 'any',
    timer: opts.timer ?? null,
    onArrive: opts.onArrive ?? null,
    markerAt: () => at,
    check(G, D) {
      const p = G.player;
      if (this.need === 'foot' && p.car !== null) return false;
      if (this.need === 'car' && p.car === null) return false;
      if (this.need === 'stageCar' && p.car !== D.stageCar) return false;
      const focus = p.car !== null && this.need !== 'foot' ? p.car : p;
      return dist(focus.x, focus.y, at.x, at.y) < r;
    },
  };
}

/** A stage finished by getting behind the wheel of the stage's marked car. */
function stealStage(text, spawn, makeCar, opts = {}) {
  return {
    text,
    onArrive: opts.onArrive ?? null,
    setup(G, D) {
      const car = makeCar(spawn);
      car.missionCar = true;
      D.stageCar = car;
      G.cars.push(car);
    },
    markerAt: (G, D) => (D.stageCar !== null ? { x: D.stageCar.x, y: D.stageCar.y } : null),
    check(G, D) {
      return D.stageCar !== null && G.player.car === D.stageCar;
    },
  };
}

function buildMissions(city) {
  const P = city.places;
  return [
    {
      id: 'wheels',
      title: 'First Wheels',
      reward: 250,
      intro: [
        { who: VERA, text: "Jax. It's Vera. Your cousin swears you can drive anything with wheels." },
        { who: VERA, text: "There's a teal sedan outside Coral Flats. It's borrowed. Bring it to the docks for me." },
        { who: JAX, text: 'Borrowed from who, exactly?' },
        { who: VERA, text: 'From someone who owes me. Move, wheelman.' },
      ],
      stages: [
        stealStage('Get in the teal sedan outside Coral Flats', { x: P.home.x - 46, y: P.home.y + 4, angle: 0 }, (s) => createCar('sedan', s.x, s.y, s.angle, '#3fae8a', city.rngRef)),
        reachStage('Drive the sedan to the Azura Docks', P.docks, 78, { need: 'stageCar' }),
      ],
      outro: [{ who: VERA, text: 'Clean work. The cash is in your account. Stick around — there is more.' }],
    },
    {
      id: 'package',
      title: 'Package Run',
      reward: 400,
      intro: [
        { who: VERA, text: 'A package waits at the Marina stores. Pick it up on foot, then bring it to my garage.' },
        { who: VERA, text: 'And Jax — someone may have talked. If the police look interested, that is why.' },
      ],
      stages: [
        reachStage('Pick up the package at the Marina (on foot)', P.marina, 44, {
          need: 'foot',
          onArrive: (G) => G.addHeat(100),
        }),
        reachStage("Deliver the package to Vera's Garage", P.garage, 64, { timer: 150 }),
      ],
      outro: [{ who: VERA, text: 'Whatever that was, it smells like money. Good driving.' }],
    },
    {
      id: 'fares',
      title: 'Meter Money',
      reward: 100,
      intro: [
        { who: VERA, text: 'I need you liquid, not busy. Run cab fares until you have banked $200 in fares.' },
        { who: VERA, text: 'Any car will do. Pick up anyone waving at the kerb with a $ over their head.' },
      ],
      stages: [
        {
          text: 'Run taxi fares: $0 / $200 banked',
          dynamicText: (G, D) => `Run taxi fares: $${Math.min(200, Math.floor(D.faresStageEarned))} / $200 banked`,
          markerAt: (G, D) => D.taxiMarker(),
          check: (G, D) => D.faresStageEarned >= 200,
        },
      ],
      outro: [{ who: VERA, text: 'Liquid. Good. Now a real job.' }],
    },
    {
      id: 'comet',
      title: 'Borrowed Comet',
      reward: 600,
      intro: [
        { who: VERA, text: 'Ocean Drive Lot. A red Comet GT, plates already swapped. The owner is... travelling.' },
        { who: VERA, text: 'Take it to my garage. If the police notice, lose them after the drop, not before.' },
      ],
      stages: [
        stealStage('Steal the red Comet GT from Ocean Drive Lot', { x: P.lot.x, y: P.lot.y - 34, angle: -Math.PI / 2 }, (s) => createCar('sports', s.x, s.y, s.angle, '#d92b2b', city.rngRef), {
          onArrive: (G) => G.addHeat(200),
        }),
        reachStage("Deliver the Comet to Vera's Garage", P.garage, 64, { need: 'stageCar' }),
      ],
      outro: [{ who: VERA, text: 'Beautiful car. Shame about the paperwork.' }],
    },
    {
      id: 'cooldown',
      title: 'Cool Down',
      reward: 500,
      intro: [
        { who: VERA, text: 'Every camera in Port Azura has your face this week, and the PD is already rolling.' },
        { who: VERA, text: 'Lose them completely. Then come lie low at the garage.' },
      ],
      stages: [
        {
          text: 'Lose the wanted level — break line of sight and stay hidden',
          setup: (G) => G.addHeat(300),
          check: (G) => G.wanted.heat <= 0,
        },
        reachStage("Lie low at Vera's Garage", P.garage, 64, {}),
      ],
      outro: [{ who: VERA, text: '"Ghost." That is the word they used on the radio.' }],
    },
    {
      id: 'nightrun',
      title: 'Night Run',
      reward: 800,
      intro: [
        { who: VERA, text: 'A client at the Palms Hotel needs the airfield, fast, and he pays for discretion.' },
        { who: VERA, text: 'Pick him up in anything with four wheels. He is nervous. Drive calm, drive quick.' },
      ],
      stages: [
        {
          text: 'Pick up the client at the Palms Hotel',
          setup(G, D) {
            const client = createPed(city.rngRef, P.hotel.x + 18, P.hotel.y - 6, 'client');
            D.stageClient = client;
            G.peds.push(client);
          },
          markerAt: (G, D) => (D.stageClient !== null ? { x: D.stageClient.x, y: D.stageClient.y } : null),
          check(G, D) {
            if (D.stageClient === null || G.player.car === null) return false;
            if (dist(G.player.car.x, G.player.car.y, D.stageClient.x, D.stageClient.y) > 52) return false;
            G.peds = G.peds.filter((ped) => ped !== D.stageClient);
            D.stageClient = null;
            G.addHeat(200);
            return true;
          },
        },
        reachStage('Drive the client to Azura Airfield', P.airfield, 84, { need: 'car', timer: 130 }),
      ],
      outro: [{ who: VERA, text: 'He made his flight. So did your reputation.' }],
    },
    {
      id: 'bastion',
      title: 'The Bastion Job',
      reward: 1500,
      intro: [
        { who: VERA, text: 'Last one, Jax. Banco del Mar moves its cash in a Bastion van. It waits by the bank.' },
        { who: VERA, text: 'Take the van to the docks. Every officer in the city will object. Object back, carefully.' },
      ],
      stages: [
        stealStage('Steal the Bastion van at Banco del Mar', { x: P.bank.x + 36, y: P.bank.y + 2, angle: 0 }, (s) => createCar('van', s.x, s.y, s.angle, '#5a6672', city.rngRef), {
          onArrive: (G) => G.addHeat(300),
        }),
        reachStage('Deliver the Bastion to the Azura Docks', P.docks, 84, { need: 'stageCar' }),
      ],
      outro: [
        { who: VERA, text: "That's the score. Port Azura is yours now, wheelman." },
        { who: VERA, text: 'Free roam: run fares, outrun the PD, enjoy the sun. Call me if you ever want work again.' },
      ],
    },
  ];
}

/** Create the director for a city. `startAt` is a mission index (Continue loads it). */
export function createDirector(city, rng, startAt = 0) {
  city.rngRef = rng; // the mission scripts borrow the world's generator for spawns
  const missions = buildMissions(city);
  const D = {
    missions,
    missionIndex: startAt,
    stageIndex: 0,
    stageSetupPending: true,
    stageCar: null,
    stageClient: null,
    dialogue: [],
    dialogueT: 0,
    timerLeft: null,
    faresStageEarned: 0,
    storyDone: startAt >= missions.length,
    introQueuedFor: -1,
    // Taxi side work.
    taxi: { phase: 'wait', client: null, dest: null, cooldownT: 4, rideDist: 0, rideT: 0, parT: 0 },

    currentMission() {
      return this.storyDone ? null : this.missions[this.missionIndex];
    },
    currentStage() {
      const m = this.currentMission();
      return m === null ? null : m.stages[this.stageIndex];
    },
    missionTitle() {
      const m = this.currentMission();
      return m === null ? 'Free Roam' : m.title;
    },
    objectiveText() {
      const stage = this.currentStage();
      if (stage !== null) {
        if (stage.dynamicText !== undefined) return stage.dynamicText(null, this);
        return stage.text;
      }
      if (this.taxi.phase === 'pickup') return 'Taxi: pick up the fare';
      if (this.taxi.phase === 'ride') return 'Taxi: drive the fare to the drop-off';
      return 'Free roam — fares pay, the city is yours';
    },
    marker() {
      const stage = this.currentStage();
      if (stage !== null && stage.markerAt !== undefined) return stage.markerAt(null, this);
      if (stage !== null && stage.at !== undefined) return stage.at;
      return this.taxiMarker();
    },
    taxiMarker() {
      if (this.taxi.phase === 'pickup' && this.taxi.client !== null) return { x: this.taxi.client.x, y: this.taxi.client.y };
      if (this.taxi.phase === 'ride' && this.taxi.dest !== null) return this.taxi.dest;
      return null;
    },
    taxiEnabled() {
      if (this.storyDone) return true;
      const m = this.currentMission();
      return m !== null && m.id === 'fares';
    },

    queueDialogue(lines) {
      for (const line of lines) this.dialogue.push(line);
      if (this.dialogue.length === lines.length) this.dialogueT = 4.4;
    },

    /** Advance the whole story by one frame. `confirm` advances dialogue at once. */
    update(G, dt, confirm) {
      // Dialogue first: while Vera talks, stage clocks hold.
      if (this.dialogue.length > 0) {
        this.dialogueT -= dt;
        if (confirm || this.dialogueT <= 0) {
          this.dialogue.shift();
          this.dialogueT = 4.4;
          G.audio.phone();
        }
        return;
      }
      if (this.storyDone) {
        this.updateTaxi(G, dt);
        return;
      }
      const mission = this.currentMission();
      if (this.introQueuedFor !== this.missionIndex) {
        this.introQueuedFor = this.missionIndex;
        this.queueDialogue(mission.intro);
        G.audio.phone();
        return;
      }
      const stage = this.currentStage();
      if (stage === null) return;
      if (this.stageSetupPending) {
        this.stageSetupPending = false;
        this.stageCar = null;
        if (stage.setup !== undefined) stage.setup(G, this);
        this.timerLeft = stage.timer ?? null;
      }
      // A wrecked stage car is replaced at its kerb, with Vera's blessing.
      if (this.stageCar !== null && this.stageCar.wrecked) {
        const fresh = createCar(this.stageCar.type, this.stageCar.x, this.stageCar.y, this.stageCar.angle, this.stageCar.color, G.rng);
        fresh.missionCar = true;
        G.cars = G.cars.filter((car) => car !== this.stageCar);
        G.cars.push(fresh);
        this.stageCar = fresh;
        this.queueDialogue([{ who: VERA, text: 'That one is done for. I found you another — same spot. Again.' }]);
        return;
      }
      if (this.timerLeft !== null) {
        this.timerLeft -= dt;
        if (this.timerLeft <= 0) {
          this.queueDialogue([{ who: VERA, text: 'Too slow. Again, from the top of this leg.' }]);
          this.stageSetupPending = true;
          if (this.stageIndex > 0 && mission.stages[this.stageIndex].timer !== null) {
            // Timed legs restart themselves, not the whole mission.
          }
          return;
        }
      }
      if (stage.check(G, this)) {
        if (stage.onArrive !== undefined && stage.onArrive !== null) stage.onArrive(G, this);
        this.stageIndex += 1;
        this.stageSetupPending = true;
        this.timerLeft = null;
        if (this.stageIndex >= mission.stages.length) {
          G.addCash(mission.reward);
          G.audio.missionDone();
          G.fx.text(G.player.x, G.player.y - 30, `${mission.title} — +$${mission.reward}`, '#8be89a');
          this.queueDialogue(mission.outro);
          this.missionIndex += 1;
          this.stageIndex = 0;
          this.faresStageEarned = 0;
          if (this.missionIndex >= this.missions.length) this.storyDone = true;
          G.onMissionComplete(this.missionIndex);
        }
      }
      if (this.taxiEnabled()) this.updateTaxi(G, dt);
    },

    /** The cab loop: a waving client, a ride across town, a fare and a tip. */
    updateTaxi(G, dt) {
      const taxi = this.taxi;
      const p = G.player;
      if (taxi.phase === 'wait') {
        taxi.cooldownT -= dt;
        if (taxi.cooldownT > 0) return;
        // A client appears at a random avenue corner near the player.
        const ci = G.rng.int(0, ROADS.length - 1);
        const ri = G.rng.int(0, ROADS.length - 1);
        const x = ROADS[ci] + 76;
        const y = ROADS[ri] + 76;
        if (dist(x, y, p.x, p.y) > 900 || dist(x, y, p.x, p.y) < 200) return;
        const client = createPed(G.rng, x, y, 'client');
        taxi.client = client;
        G.peds.push(client);
        taxi.phase = 'pickup';
        return;
      }
      if (taxi.phase === 'pickup') {
        if (taxi.client === null || taxi.client.dead) {
          taxi.phase = 'wait';
          taxi.cooldownT = 8;
          return;
        }
        if (p.car !== null && dist(p.car.x, p.car.y, taxi.client.x, taxi.client.y) < 48) {
          G.peds = G.peds.filter((ped) => ped !== taxi.client);
          taxi.client = null;
          const places = Object.values(G.city.places);
          let dest = G.rng.pick(places);
          let guard = 0;
          while (dist(dest.x, dest.y, p.x, p.y) < 800 && guard < 8) {
            dest = G.rng.pick(places);
            guard += 1;
          }
          taxi.dest = dest;
          taxi.rideDist = dist(p.x, p.y, dest.x, dest.y);
          taxi.parT = taxi.rideDist / 8.5;
          taxi.rideT = 0;
          taxi.phase = 'ride';
          G.fx.text(p.x, p.y - 26, 'Fare picked up', '#ffe9a8');
        }
        return;
      }
      if (taxi.phase === 'ride') {
        taxi.rideT += dt;
        if (p.car !== null && dist(p.car.x, p.car.y, taxi.dest.x, taxi.dest.y) < 58) {
          const fare = 30 + Math.round(taxi.rideDist / 20);
          const tip = taxi.rideT < taxi.parT ? Math.round((taxi.parT - taxi.rideT) * 0.7) : 0;
          const total = fare + tip;
          G.addCash(total);
          G.audio.cash();
          G.fx.text(p.x, p.y - 26, tip > 0 ? `Fare $${fare} + tip $${tip}` : `Fare $${fare}`, '#8be89a');
          this.faresStageEarned += total;
          taxi.phase = 'wait';
          taxi.cooldownT = 11;
          taxi.dest = null;
        }
      }
    },
  };
  return D;
}
