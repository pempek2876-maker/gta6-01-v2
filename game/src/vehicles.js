// Cars: one mesh builder for all four classes, plus arcade driving physics.
// A car is a plain object the player, traffic and police modules all share:
// { mesh, x, z, heading, speed, cls, npc, parked, stolen, wheels, lights }.
import * as THREE from 'three';
import { CAR_CLASSES } from './config.js';
import { collideCircle } from './world.js';

const BODY = {
  sedan: { w: 1.9, h: 0.62, l: 4.4, cabinW: 1.7, cabinH: 0.55, cabinL: 2.2, cabinZ: -0.2 },
  taxi: { w: 1.9, h: 0.62, l: 4.4, cabinW: 1.7, cabinH: 0.55, cabinL: 2.2, cabinZ: -0.2 },
  van: { w: 2.0, h: 1.15, l: 4.8, cabinW: 1.9, cabinH: 0.8, cabinL: 2.6, cabinZ: 0.3 },
  sport: { w: 1.95, h: 0.5, l: 4.5, cabinW: 1.6, cabinH: 0.45, cabinL: 1.9, cabinZ: -0.3 },
};

export function buildCarMesh(cls, color, isPolice = false) {
  const spec = BODY[cls] || BODY.sedan;
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), paint);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.cabinW, spec.cabinH, spec.cabinL), glass);
  cabin.position.set(0, 0.55 + spec.h / 2 + spec.cabinH / 2 - 0.08, spec.cabinZ);
  group.add(cabin);
  if (cls === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.4), dark);
    spoiler.position.set(0, 1.05, -spec.l / 2 + 0.25);
    group.add(spoiler);
  }
  if (cls === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    sign.position.set(0, 1.45, 0);
    group.add(sign);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    h.position.set(hx, 0.62, spec.l / 2 + 0.01);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const hx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    t.position.set(hx, 0.62, -spec.l / 2 - 0.01);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2e6bff }));
    bar.position.set(0, 1.42, -0.2);
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.02, 0.3, spec.l * 0.6),
      new THREE.MeshBasicMaterial({ color: 0x2244aa }));
    stripe.position.set(0, 0.55, 0);
    group.add(stripe);
  }
  return { group, wheels };
}

export function createCar(world, cls, x, z, heading, opts = {}) {
  const color = opts.color ?? CAR_CLASSES[cls].color;
  const { group, wheels } = buildCarMesh(cls, color, opts.police === true);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  world.scene.add(group);
  const car = {
    mesh: group,
    wheels,
    cls,
    x,
    z,
    heading,
    speed: 0,
    npc: opts.npc === true,
    parked: opts.parked === true,
    police: opts.police === true,
    stolen: false,
    // Traffic state (traffic.js fills these for NPC cars).
    axis: 'x',
    line: 0,
    dir: 1,
    lane: 2.4,
    waitAtLight: 0,
    targetSpeed: 0,
    brakeLights: false,
  };
  return car;
}

// Arcade driving: throttle -1..1, steer -1..1, handbrake boolean.
// Returns nothing; mutates car. Speed in m/s, heading in radians.
export function driveCar(world, car, dt, ctl) {
  const spec = CAR_CLASSES[car.cls];
  const forward = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
  let target = 0;
  if (ctl.throttle > 0) target = spec.topSpeed * ctl.throttle;
  else if (ctl.throttle < 0) target = -spec.topSpeed * 0.45 * -ctl.throttle;
  const rate = ctl.throttle !== 0 ? spec.accel : spec.brake * 0.6;
  const diff = target - car.speed;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  car.speed += step;
  if (ctl.handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);

  // Steering scales with speed; handbrake lets the tail slide.
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 6);
  const drift = ctl.handbrake ? 1.7 : 1;
  car.heading += ctl.steer * spec.steer * steerAuthority * drift * dt * Math.sign(car.speed || 1) * -1;
  // (heading sign: three.js rotation.y, forward = (sin h, cos h); steering
  // left (A, steer -1) turns the nose left, i.e. heading decreases.)

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collideCircle(world, nx, nz, 1.7);
  // A hard hit on a building kills most of the speed.
  if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) car.speed *= 0.35;
  car.x = fixed.x;
  car.z = fixed.z;

  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Wheel spin + front-wheel steer visual.
  const spin = (car.speed * dt) / 0.36;
  for (let i = 0; i < car.wheels.length; i += 1) {
    car.wheels[i].rotation.x += spin;
  }
  return forward;
}

// Remove a car from the scene.
export function removeCar(world, car) {
  world.scene.remove(car.mesh);
}
