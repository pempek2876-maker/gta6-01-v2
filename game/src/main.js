// Solmar City — boot, input, the fixed-step loop, the chase camera, and the
// ?shot= staging mode. The game object is the one place every module meets:
// world, traffic, peds, player, police, missions, combat, hud, audio.
import * as THREE from 'three';
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createMissions } from './missions.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createRandom } from './random.js';
import { stageShot } from './shots.js';
import { createTraffic } from './traffic.js';
import { createCar, driveCar } from './vehicles.js';
import { createWorld } from './world.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) | 0);

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

// --- input -------------------------------------------------------------------
const input = {
  keys: new Set(),
  pressed: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  firing: false,
  down(code) { return this.keys.has(code); },
  takePressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  },
  takeMouse() {
    const out = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return out;
  },
};
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) input.pressed.add(e.code);
  input.keys.add(e.code);
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
window.addEventListener('blur', () => input.keys.clear());
canvas.addEventListener('mousemove', (e) => {
  input.mouseDX += e.movementX || 0;
  input.mouseDY += e.movementY || 0;
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) input.firing = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.firing = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// --- world + systems -----------------------------------------------------------
const rng = createRandom(seed);
const world = createWorld(seed);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const game = {
  seed,
  time: 0,
  world,
  camera,
  renderer,
  screen: 'title', // title | play | paused | over
  stats: { missionsDone: 0, kills: 0, bestCash: 0 },
  player: null,
  traffic: null,
  peds: null,
  police: null,
  missions: null,
  combat: null,
  hud: null,
  audio: createAudio(),
  shotMode: shotName,

  say(text, seconds = 5) {
    this.missions.say(text, seconds);
  },
  saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: Math.floor(this.player.cash),
        missionIndex: this.missions.index,
        missionsDone: this.stats.missionsDone,
        kills: this.stats.kills,
      }));
      window.localStorage.setItem(BEST_KEY, String(Math.max(
        this.stats.bestCash, Math.floor(this.player.cash),
      )));
    } catch { /* storage can be off; the game still plays */ }
  },
  loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  enterCar(car) {
    const p = this.player;
    // Take the car out of traffic control.
    this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
    this.traffic.parked = this.traffic.parked.filter((c) => c !== car);
    car.npc = false;
    car.parked = false;
    p.mode = 'car';
    p.car = car;
    p.mesh.visible = false;
    // Stealing a car in view of the police is a crime.
    if (this.police.seesPlayer()) this.police.addHeat(22);
    else this.police.addHeat(6);
    this.audio.click();
  },
  tryEnterCar() {
    const p = this.player;
    let best = null;
    let bestD = 4.2;
    const all = [...this.traffic.parked, ...this.traffic.cars, ...this.police.patrol];
    for (const car of all) {
      if (car.speed && Math.abs(car.speed) > 1.5) continue;
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (best) {
      this.enterCar(best);
      this.say(`Mobil ${best.cls} diambil. Jangan sampai polisi lihat!`, 3);
    }
  },
  exitCar() {
    const p = this.player;
    if (!p.car) return;
    const car = p.car;
    car.speed = 0;
    car.parked = true;
    this.traffic.parked.push(car);
    // Step out on the driver's side.
    const side = { x: Math.cos(p.heading), z: -Math.sin(p.heading) };
    p.x = car.x + side.x * 2.2;
    p.z = car.z + side.z * 2.2;
    p.y = 0;
    p.mode = 'foot';
    p.car = null;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
  },
  onBusted() {
    if (this.screen !== 'play') return;
    this.screen = 'over';
    const fine = Math.min(Math.floor(this.player.cash), 150);
    this.player.cash -= fine;
    this.missions.fail('ditangkap polisi');
    this.hud.showEnd('BUSTED!', `Polisi Solmar menangkapmu. Denda $${fine}. Misi diulang dari awal.`);
    this.saveGame();
    setTimeout(() => this.respawn(), 2600);
  },
  onWasted() {
    if (this.screen !== 'play') return;
    this.screen = 'over';
    const lost = Math.min(Math.floor(this.player.cash), 200);
    this.player.cash -= lost;
    this.missions.fail('Jay tumbang');
    this.hud.showEnd('WASTED', `Jay dilarikan ke RS Solmar. Biaya rumah sakit $${lost}.`);
    this.saveGame();
    setTimeout(() => this.respawn(), 2600);
  },
  respawn() {
    const p = this.player;
    const hospital = this.world.spots.hospital;
    if (p.mode === 'car' && p.car) {
      p.car.parked = true;
      this.traffic.parked.push(p.car);
      p.car = null;
    }
    p.mode = 'foot';
    p.x = hospital.x;
    p.z = hospital.z;
    p.y = 0;
    p.health = 100;
    p.armor = 50;
    p.ammo = 12;
    p.mesh.visible = true;
    p.mesh.position.set(p.x, 0, p.z);
    this.police.heat = 0;
    this.police.syncStars();
    this.hud.hideEnd();
    this.screen = 'play';
  },
  // One fixed simulation step (rendering is separate, so shots can step
  // the world without drawing every frame).
  step(dt, inp) {
    this.time += dt;
    this.world.update(dt);
    const p = this.player;
    p.update(dt, inp, this);
    if (p.mode === 'car' && p.car) {
      const throttle = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
      const steer = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
      driveCar(this.world, p.car, dt, {
        throttle, steer, handbrake: inp.down('Space'),
      });
      // Hitting a pedestrian while driving is a crime.
      for (const ped of this.peds.list) {
        if (!ped.alive) continue;
        const d = Math.hypot(ped.x - p.car.x, ped.z - p.car.z);
        if (d < 1.8 && Math.abs(p.car.speed) > 3) {
          ped.alive = false;
          ped.mesh.rotation.x = Math.PI / 2;
          ped.mesh.position.y = 0.3;
          this.police.addHeat(30);
          this.say('Kau menabrak pejalan kaki! Polisi mengejarmu.');
        }
      }
      // Bumping traffic slows both cars.
      for (const car of this.traffic.cars) {
        const d = Math.hypot(car.x - p.car.x, car.z - p.car.z);
        if (d < 3.6 && d > 0.01) {
          p.car.speed *= 0.85;
          car.speed *= 0.7;
          if (this.police.seesPlayer()) this.police.addHeat(4);
        }
      }
    }
    // Shooting (left mouse held, on foot).
    if (inp.firing && p.mode === 'foot' && this.screen === 'play') this.combat.shoot();
    this.traffic.update(dt, this.time);
    this.peds.update(dt);
    this.police.update(dt);
    this.missions.update(dt);
    this.combat.update(dt);
    this.hud.update(dt);
    this.audio.update(dt, this);
  },
  // Third-person camera: behind the player (or the car), mouse orbit.
  placeCamera() {
    const p = this.player;
    const eye = p.mode === 'car' && p.car
      ? { x: p.car.x, y: 2.2, z: p.car.z }
      : p.eye();
    const dist = p.mode === 'car' ? 11 : 7.5;
    const height = p.mode === 'car' ? 4.2 : 3.1;
    // While driving, the camera settles behind the car unless the mouse
    // moved recently (free orbit).
    if (p.mode === 'car' && p.car) {
      const want = p.car.heading + Math.PI;
      let dh = want - p.camYaw;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.camYaw += dh * 0.06;
    }
    const cy = Math.cos(p.camPitch);
    const cx = eye.x + Math.sin(p.camYaw) * dist * cy;
    const cz = eye.z + Math.cos(p.camYaw) * dist * cy;
    camera.position.set(cx, eye.y + height * Math.sin(p.camPitch) + 1.2, cz);
    camera.lookAt(eye.x, eye.y + 0.4, eye.z);
  },
};

// Build the systems (order matters: player first, hud last).
// Spawn on the road (x = road line 6), never inside a building footprint.
game.player = createPlayer(world, { x: 2, z: 24 });
game.traffic = createTraffic(world, rng);
game.peds = createPeds(world, rng);
game.police = createPolice(world, rng, game);
game.missions = createMissions(world, rng, game);
game.combat = createCombat(world, rng, game);
game.hud = createHud(game);
window.__game = game;

// Restore a save, if one exists.
const save = game.loadGame();
if (save) {
  game.player.cash = save.cash || 150;
  game.stats.missionsDone = save.missionsDone || 0;
  game.stats.kills = save.kills || 0;
  game.missions.index = Math.min(save.missionIndex || 0, 4);
  game.stats.bestCash = Number(window.localStorage.getItem(BEST_KEY) || 0);
}

// --- overlays ---------------------------------------------------------------
const startBtn = document.getElementById('start-btn');
if (save) startBtn.textContent = `Lanjutkan — Misi ${game.missions.index + 1} dari 5`;
startBtn.addEventListener('click', () => {
  game.audio.init();
  game.audio.click();
  game.hud.hideTitle();
  game.screen = 'play';
  if (game.missions.state === 'idle') game.missions.start();
  else game.missions.say(`Misi ${game.missions.index + 1}: ${game.missions.current().name}`);
  statusEl.textContent = 'Solmar City. WASD jalan, E masuk mobil, klik kiri tembak.';
});
document.getElementById('resume-btn').addEventListener('click', () => {
  game.hud.hidePause();
  game.screen = 'play';
});
document.getElementById('quit-btn').addEventListener('click', () => {
  game.saveGame();
  game.hud.hidePause();
  game.hud.showTitle();
  game.screen = 'title';
});

// M: start missions. T: taxi job. P/Esc: pause.
window.addEventListener('keydown', (e) => {
  if (game.screen !== 'play') return;
  if (e.code === 'KeyM' && game.missions.state === 'idle') game.missions.start();
  if (e.code === 'KeyT') game.missions.startTaxi();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    game.screen = 'paused';
    game.hud.showPause();
  }
});
window.addEventListener('keydown', (e) => {
  if (game.screen === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) {
    game.hud.hidePause();
    game.screen = 'play';
  }
});

// --- modes --------------------------------------------------------------------
function runShot(name) {
  const staged = stageShot(name, game);
  game.hud.hideTitle();
  game.hud.hidePause();
  game.hud.hideEnd();
  camera.position.set(staged.camPos.x, staged.camPos.y, staged.camPos.z);
  camera.lookAt(staged.camLook.x, staged.camLook.y, staged.camLook.z);
  game.screen = 'play';
  game.hud.update(0);
  renderer.render(world.scene, camera);
  renderer.render(world.scene, camera);
  window.__shot = { ready: true, label: staged.label };
  window.__shotReady = true;
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.screen === 'play') {
      while (accumulator >= STEP) {
        game.step(STEP, input);
        accumulator -= STEP;
      }
      game.placeCamera();
    } else if (game.screen === 'title') {
      // Idle camera drift over the city behind the title screen.
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 180, 90, Math.cos(t * 0.05) * 180 - 40);
      camera.lookAt(0, 0, 40);
      accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.render(world.scene, camera);
  }
  game.hud.showTitle();
  statusEl.textContent = 'Solmar City — tekan MULAI untuk bermain.';
  requestAnimationFrame(frame);
}

if (shotName) runShot(shotName);
else runGame();
