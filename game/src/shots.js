// Screenshot scenes behind ?shot=chase|mission|wanted|vista.
// Each scene starts from a fresh page load (fixed seed), stages the real
// simulation forward for a fixed number of steps with scripted input, and
// returns the camera the driver should use. The same seed always gives the
// same frame: fixed steps, seeded rng, no wall-clock input.
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { roadCoord } from './world.js';

// A scripted stand-in for the keyboard/mouse input object.
function scriptedInput(keys) {
  const set = new Set(keys);
  return {
    down: (code) => set.has(code),
    takePressed: () => false,
    takeMouse: () => ({ dx: 0, dy: 0 }),
    firing: false,
  };
}

// Step the whole simulation N fixed steps with the same scripted input.
function stepN(game, seconds, keys) {
  const input = scriptedInput(keys);
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.step(STEP, input);
}

export function stageShot(name, game) {
  const world = game.world;
  const p = game.player;

  if (name === 'chase') {
    // Jay in a sport car, two patrol cars on his tail, wanted 2 stars.
    const car = createCar(world, 'sport', roadCoord(6) - 40, roadCoord(5) + 2.4, Math.PI / 2, {});
    car.speed = 22;
    game.enterCar(car);
    game.police.addHeat(55); // 2 stars, still 2 after the 5 s drive
    game.police.update(0.01);
    stepN(game, 5, ['KeyW']);
    // Stage the pursuers into frame: one right on the tail, one pulling
    // alongside in the next lane.
    game.police.patrol.forEach((cop, i) => {
      cop.x = p.x - 10 + i * 5;
      cop.z = i === 0 ? p.z : p.z - 4.4;
      cop.heading = p.heading;
      cop.speed = Math.max(18, p.car.speed - 4);
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    });
    return {
      camPos: { x: p.x - 14, y: 6, z: p.z - 13 },
      camLook: { x: p.x + 7, y: 2, z: p.z + 1 },
      label: 'chase',
    };
  }

  if (name === 'mission') {
    // On foot at the garage, mission 1 beacon lit, a parked car and
    // pedestrians nearby.
    const spot = world.spots.garage;
    p.x = spot.x + 6;
    p.z = spot.z + 4;
    p.heading = Math.atan2(spot.x - p.x, spot.z - p.z);
    p.camYaw = Math.PI - p.heading;
    game.missions.start();
    stepN(game, 2.5, []);
    // Camera behind Jay, looking past him at the golden mission beacon.
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    return {
      camPos: { x: p.x - fx * 7.5, y: 3.6, z: p.z - fz * 7.5 },
      camLook: { x: spot.x, y: 3, z: spot.z },
      label: 'mission',
    };
  }

  if (name === 'wanted') {
    // Wanted 3 stars, roadblock ahead, Jay approaching in a sedan.
    const car = createCar(world, 'sedan', roadCoord(5) - 55, roadCoord(6) - 2.4, Math.PI / 2, {});
    car.speed = 16;
    game.enterCar(car);
    game.police.addHeat(62); // 3 stars
    game.police.update(0.01);
    stepN(game, 3.5, ['KeyW']);
    // Camera at the side of Jay's car, looking ahead down the road at the
    // roadblock: the sedan leads the frame, the blockade closes it.
    return {
      camPos: { x: p.x - 6, y: 6, z: p.z - 17 },
      camLook: { x: p.x + 18, y: 2, z: p.z + 2 },
      label: 'wanted',
    };
  }

  // vista (default): golden-hour panorama over the city and the sea.
  world.timeOfDay = 0.62;
  p.x = roadCoord(6);
  p.z = roadCoord(6);
  p.heading = Math.PI;
  stepN(game, 10, []);
  return {
    camPos: { x: -40, y: 150, z: -260 },
    camLook: { x: 30, y: 0, z: 120 },
    label: 'vista',
  };
}
