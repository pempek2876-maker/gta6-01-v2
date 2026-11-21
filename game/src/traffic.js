// Traffic: NPC cars driving the road grid, plus simple timed traffic lights
// at the four central intersections. Cars follow axis-aligned lanes, turn at
// intersections, and stop for red lights and for the car ahead.
import { CAR_CLASSES, CITY, GRID, PITCH, ROAD } from './config.js';
import { createCar } from './vehicles.js';
import { int, pick, range } from './random.js';
import { nearestRoadCoord, roadCoord } from './world.js';

const LIGHT_CYCLE = 14; // seconds per full red/green cycle
const LIGHTS = [
  { x: roadCoord(5), z: roadCoord(5) },
  { x: roadCoord(6), z: roadCoord(5) },
  { x: roadCoord(5), z: roadCoord(6) },
  { x: roadCoord(6), z: roadCoord(6) },
];

// Is the light green for travel along `axis` at this intersection?
function lightGreen(axis, time) {
  const phase = (time % LIGHT_CYCLE) / LIGHT_CYCLE;
  return axis === 'x' ? phase < 0.5 : phase >= 0.5;
}

// Distance from (x, z) to the next intersection stop line along the car's
// heading, or Infinity when no light is near.
function stopLineAhead(car, time) {
  const ahead = car.dir;
  for (const L of LIGHTS) {
    if (car.axis === 'x') {
      const dz = Math.abs(car.z - L.z);
      if (dz > ROAD / 2) continue;
      const dx = (L.x - car.x) * ahead;
      if (dx > 2 && dx < 26 && !lightGreen('x', time)) return dx;
    } else {
      const dx = Math.abs(car.x - L.x);
      if (dx > ROAD / 2) continue;
      const dz = (L.z - car.z) * ahead;
      if (dz > 2 && dz < 26 && !lightGreen('z', time)) return dz;
    }
  }
  return Infinity;
}

export function createTraffic(world, rng) {
  const cars = [];
  const classes = Object.keys(CAR_CLASSES);
  // Spawn NPC cars spread over the grid.
  for (let i = 0; i < 14; i += 1) {
    const cls = pick(rng, classes);
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = int(rng, 1, GRID - 1);
    const along = range(rng, -140, 140);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = 2.4;
    const x = axis === 'x' ? along : roadCoord(line) + (dir === 1 ? lane : -lane);
    const z = axis === 'x' ? roadCoord(line) + (dir === 1 ? lane : -lane) : along;
    const heading = axis === 'x' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI);
    const car = createCar(world, cls, x, z, heading, { npc: true });
    car.axis = axis;
    car.line = line;
    car.dir = dir;
    car.lane = lane;
    car.cruise = range(rng, 7, 11);
    cars.push(car);
  }
  // Parked cars along the kerb (stealable).
  const parked = [];
  for (let i = 0; i < 10; i += 1) {
    const cls = pick(rng, classes);
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = int(rng, 1, GRID - 1);
    const along = range(rng, -160, 160);
    const x = axis === 'x' ? along : roadCoord(line) + ROAD / 2 - 1.6;
    const z = axis === 'x' ? roadCoord(line) + ROAD / 2 - 1.6 : along;
    const heading = axis === 'x' ? Math.PI / 2 : 0;
    const car = createCar(world, cls, x, z, heading, { parked: true });
    parked.push(car);
  }

  const traffic = {
    cars,
    parked,
    lights: LIGHTS,
    update(dt, time) {
      for (const car of cars) {
        // Are we at an intersection? Decide to turn or go straight.
        const along = car.axis === 'x' ? car.x : car.z;
        const linePos = nearestRoadCoord(along);
        const distToLine = Math.abs(along - linePos);
        const atJunction = distToLine < 1.2 && Math.abs(car.speed) > 0.5;
        if (atJunction && !car.turnedAt) {
          car.turnedAt = linePos;
          if (rng() < 0.4) {
            // Turn onto the crossing road. The crossing road's line index
            // comes from the car's coordinate on the other axis.
            const crossCoord = car.axis === 'x' ? car.z : car.x;
            const crossLine = Math.max(
              0,
              Math.min(GRID, Math.round((crossCoord + CITY / 2 - ROAD / 2) / PITCH)),
            );
            const newAxis = car.axis === 'x' ? 'z' : 'x';
            const newDir = rng() < 0.5 ? 1 : -1;
            car.axis = newAxis;
            car.line = crossLine;
            car.dir = newDir;
            car.heading = newAxis === 'x'
              ? (newDir === 1 ? Math.PI / 2 : -Math.PI / 2)
              : (newDir === 1 ? 0 : Math.PI);
            // Snap onto the new lane.
            if (newAxis === 'x') {
              car.z = roadCoord(crossLine) + (newDir === 1 ? car.lane : -car.lane);
            } else {
              car.x = roadCoord(crossLine) + (newDir === 1 ? car.lane : -car.lane);
            }
          }
        } else if (!atJunction) {
          car.turnedAt = null;
        }

        // Stop for a red light or a slow car ahead.
        let throttle = 1;
        const stop = stopLineAhead(car, time);
        if (stop < 12) throttle = 0;
        // Keep a gap to the car ahead on the same lane.
        for (const other of cars) {
          if (other === car || other.axis !== car.axis || other.line !== car.line) continue;
          const gap = car.axis === 'x' ? (other.x - car.x) * car.dir : (other.z - car.z) * car.dir;
          if (gap > 0 && gap < 10) { throttle = 0; break; }
        }
        const target = throttle > 0 ? car.cruise : 0;
        const rate = throttle > 0 ? 5 : 14;
        car.speed += Math.max(-rate * dt, Math.min(rate * dt, target - car.speed));
        // Steer along the lane (snap heading, arcade style).
        const wantHeading = car.axis === 'x'
          ? (car.dir === 1 ? Math.PI / 2 : -Math.PI / 2)
          : (car.dir === 1 ? 0 : Math.PI);
        let dh = wantHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        car.heading += dh * Math.min(1, 6 * dt);
        // Advance along the road.
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        car.x = nx;
        car.z = nz;
        // Wrap around the city edge so traffic never runs out.
        if (car.x > 340) car.x = -340;
        if (car.x < -340) car.x = 340;
        if (car.z > 340) car.z = -340;
        if (car.z < -340) car.z = 340;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        const spin = (car.speed * dt) / 0.36;
        for (const w of car.wheels) w.rotation.x += spin;
      }
    },
  };
  return traffic;
}
