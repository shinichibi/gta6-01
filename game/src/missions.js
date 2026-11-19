// The story of Neon Tide, run as a director: eight jobs for the fixer Vera Castellan,
// told over the phone, each a short chain of stages (go here, take that car, lose the
// police, deliver — and, since the harbour opened, sail there). Between and after the
// jobs, cab fares pay the rent and street races pay better. The director owns
// objectives, markers, timers and dialogue; the loop owns everything else.

import { ROADS, WORLD } from './config.js';
import { randomRoadPoint } from './city.js';
import { createBoat, createCar, createPed } from './entities.js';
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

/** A stage finished by arriving somewhere by boat — the harbour's answer to reachStage. */
function reachBoatStage(text, at, r, opts = {}) {
  return {
    text,
    at,
    r,
    timer: opts.timer ?? null,
    onArrive: opts.onArrive ?? null,
    markerAt: () => at,
    check(G) {
      const p = G.player;
      return p.boat !== null && dist(p.boat.x, p.boat.y, at.x, at.y) < r;
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
      id: 'saltair',
      title: 'Salt Air',
      reward: 900,
      intro: [
        { who: VERA, text: 'New work, Jax — the harbour kind. A courier skiff waits at the Marina pier, south shore.' },
        { who: VERA, text: 'Sail east, around the point, to the Sirena at anchor. Take her package to the Docks pier.' },
        { who: JAX, text: 'And if the harbour patrol asks questions?' },
        { who: VERA, text: 'Wave. Smile. Throttle.' },
      ],
      stages: [
        {
          text: 'Take the skiff at the Marina pier (south shore)',
          setup(G, D) {
            let boat = G.boats.find((b) => b.driver === 'docked' && dist(b.x, b.y, P.pierMarina.x, P.pierMarina.y) < 220);
            if (boat === undefined) {
              boat = createBoat('skiff', P.pierMarina.x + 34, WORLD.h + 96, Math.PI / 2, null, city.rngRef);
              G.boats.push(boat);
            }
            boat.missionBoat = true;
            D.stageBoat = boat;
          },
          markerAt: (G, D) => (D.stageBoat !== null ? { x: D.stageBoat.x, y: D.stageBoat.y } : null),
          check: (G, D) => D.stageBoat !== null && G.player.boat === D.stageBoat,
        },
        {
          text: 'Sail east to the anchored Sirena yacht',
          setup(G, D) {
            const yacht = createBoat('yacht', P.yachtAnchor.x, P.yachtAnchor.y, -Math.PI / 2, '#f2f0e6', city.rngRef);
            yacht.driver = 'anchored';
            yacht.missionBoat = true;
            D.stageYacht = yacht;
            G.boats.push(yacht);
          },
          markerAt: (G, D) => (D.stageYacht !== null ? { x: D.stageYacht.x, y: D.stageYacht.y } : null),
          check: (G, D) => G.player.boat !== null && D.stageYacht !== null
            && dist(G.player.boat.x, G.player.boat.y, D.stageYacht.x, D.stageYacht.y) < 135,
          onArrive: (G) => G.addHeat(60),
        },
        reachBoatStage('Bring the package to the Docks pier', { x: P.pierDocks.x, y: WORLD.h + 120 }, 130, { timer: 170 }),
      ],
      outro: [{ who: VERA, text: 'Salt air suits you. The docks remember who delivers.' }],
      cleanup(G, D) {
        if (D.stageYacht !== null) {
          G.boats = G.boats.filter((boat) => boat !== D.stageYacht);
          D.stageYacht = null;
        }
        if (D.stageBoat !== null) D.stageBoat.missionBoat = false;
      },
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
        { who: VERA, text: 'Free roam: run fares, race the checkpoints, outrun the PD, enjoy the sun.' },
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
    stageBoat: null,
    stageYacht: null,
    stageClient: null,
    dialogue: [],
    dialogueT: 0,
    timerLeft: null,
    faresStageEarned: 0,
    storyDone: startAt >= missions.length,
    introQueuedFor: -1,
    // Vera's Kite SMG waits at the garage once the Package Run is done; the loop
    // hands it over when the player walks up to it.
    smgDropped: startAt >= 2,
    smgGiven: false,
    // Taxi side work.
    taxi: { phase: 'wait', client: null, dest: null, cooldownT: 4, rideDist: 0, rideT: 0, parT: 0 },
    // Street races: checkpoint sprints across town, offered in free roam.
    race: { phase: 'idle', start: null, checkpoints: [], index: 0, t: 0, countT: 0, lastCount: 4, best: null, cooldownT: 20 },

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
      const R = this.race;
      if (R.phase === 'toStart') return 'Street race: reach the green start marker';
      if (R.phase === 'count') return `Street race: ${Math.max(1, Math.ceil(R.countT))}…`;
      if (R.phase === 'run') return `Street race: checkpoint ${Math.min(R.index + 1, R.checkpoints.length)} of ${R.checkpoints.length}`;
      if (this.taxi.phase === 'pickup') return 'Taxi: pick up the fare';
      if (this.taxi.phase === 'ride') return 'Taxi: drive the fare to the drop-off';
      return 'Free roam — fares pay, races pay better';
    },
    /** The race clock for the HUD's timer line, or null when no race is live. */
    raceClock() {
      if (this.race.phase === 'run') return this.race.t.toFixed(1);
      if (this.race.phase === 'count') return 'READY';
      return null;
    },
    marker() {
      const stage = this.currentStage();
      if (stage !== null && stage.markerAt !== undefined) return stage.markerAt(null, this);
      if (stage !== null && stage.at !== undefined) return stage.at;
      const R = this.race;
      if (R.phase === 'toStart' && R.start !== null) return { ...R.start, color: '#5dff8a' };
      if ((R.phase === 'count' || R.phase === 'run') && R.checkpoints[R.index] !== undefined) {
        return { ...R.checkpoints[R.index], color: '#5dff8a' };
      }
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
    raceEnabled() {
      return this.storyDone || this.missionIndex >= 3;
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
      if (!this.smgGiven && this.missionIndex >= 2) this.smgDropped = true;
      if (this.storyDone) {
        if (this.race.phase === 'idle') this.updateTaxi(G, dt);
        this.updateRace(G, dt);
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
        this.stageBoat = null;
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
      // A wrecked stage boat is replaced at its pier the same way.
      if (this.stageBoat !== null && this.stageBoat.wrecked) {
        const fresh = createBoat(this.stageBoat.type, this.stageBoat.x, this.stageBoat.y, this.stageBoat.angle, this.stageBoat.color, G.rng);
        fresh.missionBoat = true;
        fresh.driver = 'docked';
        G.boats = G.boats.filter((boat) => boat !== this.stageBoat);
        G.boats.push(fresh);
        if (G.player.boat === this.stageBoat) {
          G.player.boat = fresh;
          fresh.driver = 'player';
        }
        this.stageBoat = fresh;
        this.queueDialogue([{ who: VERA, text: 'That hull is done for. I found you another — same pier. Again.' }]);
        return;
      }
      if (this.timerLeft !== null) {
        this.timerLeft -= dt;
        if (this.timerLeft <= 0) {
          this.queueDialogue([{ who: VERA, text: 'Too slow. Again, from the top of this leg.' }]);
          this.stageSetupPending = true;
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
          if (mission.cleanup !== undefined) mission.cleanup(G, this);
          this.queueDialogue(mission.outro);
          this.missionIndex += 1;
          this.stageIndex = 0;
          this.faresStageEarned = 0;
          if (this.missionIndex >= this.missions.length) this.storyDone = true;
          G.onMissionComplete(this.missionIndex);
        }
      }
      if (this.taxiEnabled() && this.race.phase === 'idle') this.updateTaxi(G, dt);
      if (this.raceEnabled()) this.updateRace(G, dt);
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
          // Fares ride to land places only — nobody flags a cab to the open sea.
          const landKeys = ['home', 'hospital', 'garage', 'bank', 'hotel', 'police', 'marina', 'docks', 'airfield', 'lot'];
          let dest = G.city.places[G.rng.pick(landKeys)];
          let guard = 0;
          while (dist(dest.x, dest.y, p.x, p.y) < 800 && guard < 8) {
            dest = G.city.places[G.rng.pick(landKeys)];
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

    /**
     * The street-race loop: a green start marker appears for a driver with time on
     * his hands; reaching it deals six checkpoints across town against the clock.
     * Getting out of the car at any point abandons the race.
     */
    updateRace(G, dt) {
      const R = this.race;
      const p = G.player;
      if (R.phase === 'idle') {
        if (!this.raceEnabled() || this.taxi.phase !== 'wait') return;
        R.cooldownT -= dt;
        if (R.cooldownT > 0 || p.car === null) return;
        for (let tries = 0; tries < 6; tries += 1) {
          const spot = randomRoadPoint(G.rng, p, 480);
          const d = dist(spot.x, spot.y, p.x, p.y);
          if (d < 1150) {
            R.start = spot;
            R.phase = 'toStart';
            G.fx.text(p.x, p.y - 30, 'Street race — green marker', '#5dff8a');
            return;
          }
        }
        R.cooldownT = 6;
        return;
      }
      if (p.car === null) {
        R.phase = 'idle';
        R.cooldownT = 12;
        R.start = null;
        R.checkpoints = [];
        G.fx.text(p.x, p.y - 26, 'Race abandoned', '#ff9a3d');
        return;
      }
      if (R.phase === 'toStart') {
        if (dist(p.car.x, p.car.y, R.start.x, R.start.y) < 55) {
          const checkpoints = [];
          let prev = R.start;
          for (let i = 0; i < 6; i += 1) {
            let next = randomRoadPoint(G.rng, prev, 520);
            let guard = 0;
            while (dist(next.x, next.y, prev.x, prev.y) > 1350 && guard < 8) {
              next = randomRoadPoint(G.rng, prev, 520);
              guard += 1;
            }
            checkpoints.push(next);
            prev = next;
          }
          R.checkpoints = checkpoints;
          R.index = 0;
          R.countT = 3.2;
          R.lastCount = 4;
          R.phase = 'count';
        }
        return;
      }
      if (R.phase === 'count') {
        R.countT -= dt;
        const c = Math.ceil(R.countT);
        if (c < R.lastCount) {
          R.lastCount = c;
          G.audio.countBeep(R.countT <= 0.2);
        }
        if (R.countT <= 0) {
          R.phase = 'run';
          R.t = 0;
        }
        return;
      }
      if (R.phase === 'run') {
        R.t += dt;
        const cp = R.checkpoints[R.index];
        if (cp !== undefined && dist(p.car.x, p.car.y, cp.x, cp.y) < 78) {
          R.index += 1;
          G.audio.pickup();
          G.fx.ring(cp.x, cp.y, '#5dff8a', 84);
          if (R.index >= R.checkpoints.length) {
            const payout = Math.max(60, Math.round(430 - R.t * 4));
            const isBest = R.best === null || R.t < R.best;
            if (isBest) R.best = R.t;
            G.addCash(payout);
            G.audio.cash();
            G.fx.text(p.x, p.y - 30, `Race ${R.t.toFixed(1)}s — +$${payout}${isBest ? ' · best!' : ''}`, '#8be89a');
            R.phase = 'idle';
            R.cooldownT = 25;
            R.start = null;
            R.checkpoints = [];
          }
        }
      }
    },
  };
  return D;
}
