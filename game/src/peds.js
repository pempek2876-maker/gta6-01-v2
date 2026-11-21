// Pedestrians: simple capsule people walking the sidewalks, turning at
// corners, stepping aside for cars, and running away when a gun goes off.
// One of them can be a taxi passenger.
import * as THREE from 'three';
import { GRID, PED_COUNT, PED_FLEE_SPEED, PED_SPEED, ROAD } from './config.js';
import { int, pick, range } from './random.js';
import { collideCircle, nearestRoadCoord, roadCoord } from './world.js';

const SHIRTS = [0xe8632c, 0x3f6fb5, 0x7dbb5a, 0xf2c230, 0xb45ac9, 0xe8e8e8, 0x2e2e2e, 0xd94f6b];
const NAMES = [
  'Rina', 'Budi', 'Sari', 'Agus', 'Maya', 'Dedi', 'Lina', 'Joko',
  'Putri', 'Andi', 'Nina', 'Rudi', 'Tania', 'Fajar', 'Wulan', 'Eko',
];

function buildPedMesh(shirtColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), pants);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.11;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x1c1410 }));
  hair.position.y = 1.66;
  group.add(hair);
  return group;
}

export function createPeds(world, rng) {
  const list = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const mesh = buildPedMesh(pick(rng, SHIRTS));
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = int(rng, 0, GRID);
    const along = range(rng, -300, 300);
    const side = rng() < 0.5 ? 1 : -1;
    // Sidewalk offset: just outside the asphalt edge.
    const off = ROAD / 2 + 2.2;
    const x = axis === 'x' ? along : roadCoord(line) + side * off;
    const z = axis === 'x' ? roadCoord(line) + side * off : along;
    mesh.position.set(x, 0, z);
    world.scene.add(mesh);
    list.push({
      mesh,
      name: NAMES[i % NAMES.length],
      x,
      z,
      heading: rng() * Math.PI * 2,
      axis,
      line,
      side,
      speed: range(rng, PED_SPEED * 0.7, PED_SPEED * 1.3),
      flee: 0, // seconds of fleeing left
      fleeFrom: null,
      bobPhase: rng() * Math.PI * 2,
      alive: true,
      isPassenger: false,
    });
  }

  const peds = {
    list,
    // A gunshot at (x, z) scares nearby pedestrians into running away.
    scare(x, z, radius = 26) {
      for (const p of list) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < radius) {
          p.flee = 3;
          p.fleeFrom = { x, z };
        }
      }
    },
    update(dt) {
      for (const p of list) {
        if (!p.alive) continue;
        p.bobPhase += dt * 8;
        let speed = p.speed;
        let heading = p.heading;
        if (p.flee > 0) {
          p.flee -= dt;
          speed = PED_FLEE_SPEED;
          const dx = p.x - p.fleeFrom.x;
          const dz = p.z - p.fleeFrom.z;
          heading = Math.atan2(dx, dz);
        } else {
          // Walk along the sidewalk; at a corner, turn onto the next road.
          const along = p.axis === 'x' ? p.x : p.z;
          const linePos = nearestRoadCoord(along);
          if (Math.abs(along - linePos) < 0.8) {
            if (rng() < 0.3) {
              p.axis = p.axis === 'x' ? 'z' : 'x';
              p.side = rng() < 0.5 ? 1 : -1;
            }
          }
          const off = ROAD / 2 + 2.2;
          heading = p.axis === 'x' ? Math.PI / 2 : 0;
          // Keep on the correct side of the road.
          const want = p.axis === 'x'
            ? roadCoord(p.line) + p.side * off
            : roadCoord(p.line) + p.side * off;
          const coord = p.axis === 'x' ? p.z : p.x;
          if (Math.abs(coord - want) > 0.4) {
            // Drift back toward the sidewalk line.
            if (p.axis === 'x') p.z += Math.sign(want - p.z) * speed * dt * 0.5;
            else p.x += Math.sign(want - p.x) * speed * dt * 0.5;
          }
        }
        p.heading = heading;
        const nx = p.x + Math.sin(heading) * speed * dt;
        const nz = p.z + Math.cos(heading) * speed * dt;
        const fixed = collideCircle(world, nx, nz, 0.5);
        p.x = fixed.x;
        p.z = fixed.z;
        // Wrap around the city edge.
        if (p.x > 340) p.x = -340;
        if (p.x < -340) p.x = 340;
        if (p.z > 340) p.z = -340;
        if (p.z < -340) p.z = 340;
        p.mesh.position.set(p.x, Math.abs(Math.sin(p.bobPhase)) * 0.05, p.z);
        p.mesh.rotation.y = heading;
      }
    },
  };
  return peds;
}
