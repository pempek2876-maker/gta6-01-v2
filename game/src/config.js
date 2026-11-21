// Every tuning number, colour and name in one place, so the game can be
// retuned without touching the simulation. Solmar City is a fictional sunny
// coastal city: nothing here is a Rockstar name, place or character.

// --- city layout -------------------------------------------------------------
// A 12x12 grid of blocks. Roads run between blocks; the sea lies south.
export const GRID = 12; // blocks per side
export const BLOCK = 46; // block side, metres
export const ROAD = 14; // road width, metres
export const PITCH = BLOCK + ROAD; // distance between road centrelines
export const CITY = GRID * PITCH + ROAD; // full city span, metres
// World x/z of the city centre is 0,0. The sea starts at this z.
export const SEA_Z = CITY / 2 + 26;

// --- simulation --------------------------------------------------------------
export const STEP = 1 / 60; // fixed simulation step, seconds
export const DAY_LENGTH = 600; // one full sun cycle, seconds
export const START_TIME_OF_DAY = 0.32; // morning light

// --- player ------------------------------------------------------------------
export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 8.4,
  accel: 42,
  friction: 30,
  jumpSpeed: 7.5,
  gravity: 22,
  radius: 0.55,
  height: 1.8,
  health: 100,
  armor: 50,
  punchDamage: 12,
};

// --- cars --------------------------------------------------------------------
// Four classes with different handling. All arcade: no real physics engine.
export const CAR_CLASSES = {
  sedan: { name: 'Marlin Sedan', accel: 16, topSpeed: 30, brake: 34, steer: 1.9, grip: 8, color: 0x3f6fb5, price: 0 },
  taxi: { name: 'Solmar Cab', accel: 14, topSpeed: 27, brake: 32, steer: 2.0, grip: 8, color: 0xf2c230, price: 0 },
  van: { name: 'Harbor Van', accel: 11, topSpeed: 24, brake: 28, steer: 1.6, grip: 7, color: 0xd8d3c8, price: 0 },
  sport: { name: 'Vortex GT', accel: 24, topSpeed: 44, brake: 40, steer: 2.4, grip: 11, color: 0xc22e3d, price: 0 },
};
export const CAR_COUNT_NPC = 14; // traffic cars
export const CAR_COUNT_PARKED = 10; // stealable parked cars

// --- pedestrians ---------------------------------------------------------------
export const PED_COUNT = 26;
export const PED_SPEED = 1.5;
export const PED_FLEE_SPEED = 4.2;

// --- wanted / police -----------------------------------------------------------
export const WANTED_MAX = 5;
// Heat (0..100) drives the star count; stars rise fast, fall slowly.
export const WANTED = {
  stealCar: 22,
  hitPed: 30,
  hitCar: 8,
  shoot: 18,
  killCop: 45,
  decayPerSecond: 1.6, // while unseen
  decaySeenPerSecond: 0.25,
  starThresholds: [0, 18, 38, 58, 78, 92],
};
export const COP_COUNT_PATROL = 3; // patrol cars roaming at wanted >= 1
export const COP_COUNT_FOOT = 4; // foot cops at wanted >= 1

// --- combat --------------------------------------------------------------------
export const PISTOL = {
  damage: 34,
  headshot: 70,
  magSize: 12,
  reloadSeconds: 1.4,
  range: 90,
  spread: 0.012,
  fireInterval: 0.22,
};

// --- missions ------------------------------------------------------------------
// Five chained story missions for Jay Marlowe, a hire driver in debt.
export const MISSIONS = [
  {
    id: 'm1',
    name: 'Paket Kilat',
    brief: 'Antar paket ke gudang utara. Jangan terlambat — Bos Rocco tidak suka menunggu.',
    payout: 250,
    steps: [
      { type: 'goto', label: 'Ambil paket di bengkel Marlin', spot: 'garage' },
      { type: 'goto', label: 'Antar paket ke gudang utara', spot: 'warehouse', timeLimit: 75 },
    ],
  },
  {
    id: 'm2',
    name: 'Kejar-Kejaran',
    brief: 'Mobil kurir kabur membawa uangmu. Kejar dan tabrak dia sampai berhenti.',
    payout: 400,
    steps: [
      { type: 'chase', label: 'Kejar mobil kurir itu!', spot: 'courier', timeLimit: 90 },
    ],
  },
  {
    id: 'm3',
    name: 'Rampok Toko',
    brief: 'Toko Sol di jalan Merdeka penuh uang tunai. Masuk, tahan, lalu kabur.',
    payout: 650,
    steps: [
      { type: 'goto', label: 'Masuk ke Toko Sol', spot: 'store' },
      { type: 'rob', label: 'Tahan tombol — isi tas dengan uang', spot: 'store', holdSeconds: 8 },
      { type: 'escape', label: 'Kabur! Hilangkan bintang wanted', spot: 'hideout', timeLimit: 120 },
    ],
  },
  {
    id: 'm4',
    name: 'Kabur dari Polisi',
    brief: 'Polisi Solmar mengincarmu. Bertahan dan hilangkan mereka.',
    payout: 500,
    steps: [
      { type: 'escape', label: 'Lepas dari kejaran polisi', spot: 'hideout', timeLimit: 100 },
    ],
  },
  {
    id: 'm5',
    name: 'Antar ke Pelabuhan',
    brief: 'Antar "barang" ke pelabuhan selatan. Wanted 4 bintang menantimu — jangan berhenti.',
    payout: 1200,
    steps: [
      { type: 'goto', label: 'Ambil barang di gudang utara', spot: 'warehouse' },
      { type: 'goto', label: 'Antar ke dermaga pelabuhan', spot: 'harbor', timeLimit: 120 },
    ],
  },
];

// Side jobs, repeatable.
export const TAXI_FARE = 120;
export const ROBBERY_TAKE = 300;

// --- palette -------------------------------------------------------------------
export const PALETTE = {
  skyDay: '#7ec8f2',
  skySunset: '#f2a35e',
  skyNight: '#101a33',
  sea: '#2e86ab',
  sand: '#e8d5a3',
  asphalt: '#33363d',
  asphaltLight: '#3d4048',
  sidewalk: '#9a938a',
  buildingGlass: '#9fc4d8',
  grass: '#5d9b4a',
  playerJacket: '#e8632c',
  copBlue: '#2244aa',
  copLightRed: '#ff2e2e',
  copLightBlue: '#2e6bff',
  taxiYellow: '#f2c230',
  hudText: '#f4f6f8',
  hudMuted: '#c8ccd2',
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudAccent: '#ffc233',
  missionGold: '#ffd34d',
  danger: '#ff4d4d',
};

// Fictional street and business names (all invented for Solmar City).
export const STREETS = [
  'Jalan Merdeka', 'Jalan Pelabuhan', 'Jalan Matahari', 'Jalan Karang',
  'Jalan Flamingo', 'Jalan Mercusuar', 'Jalan Anggrek', 'Jalan Ombak',
  'Jalan Kenanga', 'Jalan Pelangi', 'Jalan Senja', 'Jalan Teratai',
];
export const SHOPS = [
  'Toko Sol', 'Kopi Pagi', 'Bengkel Marlin', 'Roti Mentari', 'Pasar Ikan',
  'Apotek Sehat', 'Laundry Kilat', 'Warung Bu Tini', 'Toko Bunga Lili',
  'Gudang Utara', 'Dermaga 7', 'Hotel Cakrawala',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmar-city.save.v1';
export const BEST_KEY = 'solmar-city.best.v1';
