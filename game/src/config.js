// Neon Tide — shared tuning for the whole game: the size of Port Azura, its road grid,
// the colours of a sun-soaked coastal city, and the numbers every system agrees on.

/** Fixed simulation step, seconds. The loop never advances the world by any other amount. */
export const STEP = 1 / 60;

/** The city is a square of land; past its rim the canvas is open water. */
export const WORLD = { w: 3520, h: 3520 };

/**
 * Road centre lines, the same list on both axes: eight avenues each way, evenly spaced,
 * so the city is a grid of 7 by 7 blocks with a margin of sand at the rim.
 */
export const ROADS = [220, 660, 1100, 1540, 1980, 2420, 2860, 3300];

/** Half the width of a road, kerb to centre line. */
export const ROAD_HALF = 66;

/** How far from a centre line a traffic lane sits (right-hand traffic). */
export const LANE_OFF = 30;

/** Width of the pavement ring around every block. */
export const SIDEWALK = 18;

/** localStorage key for the saved game. */
export const SAVE_KEY = 'neontide.save.v1';

/** The look of Port Azura: pastel walls, bleached pavements, teal water. */
export const PALETTE = {
  water: '#2b8aa0',
  waterDeep: '#227186',
  sand: '#e6d29b',
  ground: '#b5ab90',
  sidewalk: '#d8d0ba',
  park: '#79b657',
  parkDark: '#679c49',
  asphalt: '#41464e',
  asphaltDark: '#363b42',
  laneLine: '#e8e4d2',
  centreLine: '#f2c14e',
  crosswalk: '#e9e6da',
  roofEdge: 'rgba(0,0,0,0.18)',
  buildingWalls: ['#f2e3c6', '#f6cfa8', '#eeb4a0', '#cfe3d8', '#f7ead9', '#e8b7c8', '#fdf6ec', '#bcd8e8'],
  buildingRoofs: ['#c96f4a', '#a8573f', '#8f9aa4', '#b08968', '#7d8c74', '#c25e63', '#5f7f8c', '#946846'],
};

/** Car paint jobs the city drives in. */
export const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#f2f0e6', '#2f3338', '#f2b63d', '#3fae8a', '#8a5fc0', '#e87fb1', '#7a8894', '#c0c6cc'];

/** How much heat (0..500) each crime adds; a star is every full 100. */
export const HEAT = {
  carjack: 60,
  gunshotHeard: 12,
  hitCar: 22,
  runOverPed: 120,
  killPed: 90,
  hitPolice: 150,
  killCop: 160,
  missionAlarm: 200,
};

/** Heat lost per second once no officer has seen the player for a while. */
export const HEAT_DECAY = 5;
export const HEAT_HIDE_SECONDS = 5;
