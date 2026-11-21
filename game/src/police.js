// Wanted system + police: patrol cars that chase, foot cops that run the
// player down, roadblocks at 3+ stars, a helicopter at 5 stars, and the
// busted / wasted outcomes. Heat rises on crimes and falls when unseen.
import * as THREE from 'three';
import { CAR_CLASSES, COP_COUNT_FOOT, COP_COUNT_PATROL, WANTED } from './config.js';
import { createCar, driveCar } from './vehicles.js';
import { collideCircle, roadCoord } from './world.js';

function buildCopMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x2244aa });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.82, 0.26), navy);
  legs.position.y = 0.41;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.64, 0.3), navy);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.68;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.09, 10),
    new THREE.MeshLambertMaterial({ color: 0x11131a }));
  cap.position.y = 1.85;
  group.add(cap);
  return group;
}

function buildHeli() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 4.6),
    new THREE.MeshLambertMaterial({ color: 0x1c2f57 }));
  group.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x9fc4d8 }));
  glass.position.set(0, 0.1, 1.6);
  group.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 0.95;
  group.add(rotor);
  const light = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
  light.position.y = -13;
  light.rotation.x = Math.PI;
  group.add(light);
  return { group, rotor };
}

export function createPolice(world, rng, game) {
  const police = {
    heat: 0,
    stars: 0,
    patrol: [],
    foot: [],
    roadblock: [],
    heli: null,
    bustedTimer: 0,
    // Crimes feed heat; the star count follows thresholds.
    addHeat(amount) {
      this.heat = Math.min(100, this.heat + amount);
      this.syncStars();
    },
    syncStars() {
      let stars = 0;
      for (let i = 0; i < WANTED.starThresholds.length; i += 1) {
        if (this.heat >= WANTED.starThresholds[i]) stars = i;
      }
      this.stars = stars;
    },
    // Do the police currently see the player? (line of sight is just range
    // here: the city is open and the minimap shows the same rule.)
    seesPlayer() {
      const p = game.player;
      for (const car of this.patrol) {
        if (Math.hypot(car.x - p.x, car.z - p.z) < 55) return true;
      }
      for (const cop of this.foot) {
        if (Math.hypot(cop.x - p.x, cop.z - p.z) < 26) return true;
      }
      return false;
    },
    spawnPatrol(x, z) {
      const car = createCar(world, 'sedan', x, z, 0, {
        police: true, color: 0xf2f2f2, npc: true,
      });
      car.cruise = 13;
      this.patrol.push(car);
      return car;
    },
    spawnFootCop(x, z) {
      const mesh = buildCopMesh();
      mesh.position.set(x, 0, z);
      world.scene.add(mesh);
      const cop = { mesh, x, z, heading: 0, speed: 0 };
      this.foot.push(cop);
      return cop;
    },
    clearRoadblock() {
      for (const car of this.roadblock) world.scene.remove(car.mesh);
      this.roadblock = [];
    },
    spawnRoadblock() {
      this.clearRoadblock();
      const p = game.player;
      // Block the road ahead of the player: three patrol cars across it.
      const aheadX = p.x + Math.sin(p.heading) * 26;
      const aheadZ = p.z + Math.cos(p.heading) * 26;
      const roadX = Math.abs(aheadX) < 300 ? aheadX : p.x;
      const roadZ = Math.abs(aheadZ) < 300 ? aheadZ : p.z;
      for (let i = -1; i <= 1; i += 1) {
        const car = createCar(world, 'sedan', roadX + i * 4.4, roadZ, p.heading + Math.PI / 2, {
          police: true, color: 0xf2f2f2,
        });
        this.roadblock.push(car);
      }
    },
    spawnHeli() {
      if (this.heli) return;
      const { group, rotor } = buildHeli();
      world.scene.add(group);
      this.heli = { mesh: group, rotor, angle: 0 };
    },
    clearHeli() {
      if (!this.heli) return;
      world.scene.remove(this.heli.mesh);
      this.heli = null;
    },
    update(dt) {
      const p = game.player;
      const seen = this.stars > 0 && this.seesPlayer();
      // Heat decay: fast when hidden, slow when seen.
      if (this.stars > 0) {
        this.heat = Math.max(0, this.heat - (seen ? WANTED.decaySeenPerSecond : WANTED.decayPerSecond) * dt);
        this.syncStars();
      }
      // Scale the force to the star count.
      const wantPatrol = this.stars >= 1 ? Math.min(COP_COUNT_PATROL, this.stars) : 0;
      while (this.patrol.length < wantPatrol) {
        const a = rng() * Math.PI * 2;
        this.spawnPatrol(p.x + Math.sin(a) * 60, p.z + Math.cos(a) * 60);
      }
      while (this.patrol.length > wantPatrol) {
        const car = this.patrol.pop();
        world.scene.remove(car.mesh);
      }
      const wantFoot = this.stars >= 1 ? Math.min(COP_COUNT_FOOT, this.stars + 1) : 0;
      while (this.foot.length < wantFoot) {
        const a = rng() * Math.PI * 2;
        this.spawnFootCop(p.x + Math.sin(a) * 30, p.z + Math.cos(a) * 30);
      }
      while (this.foot.length > wantFoot) {
        const cop = this.foot.pop();
        world.scene.remove(cop.mesh);
      }
      // Roadblock at 3+ stars, helicopter at 5.
      if (this.stars >= 3 && this.roadblock.length === 0) this.spawnRoadblock();
      if (this.stars < 3) this.clearRoadblock();
      if (this.stars >= 5) this.spawnHeli();
      else this.clearHeli();

      // Patrol cars chase the player (arcade pursuit steering).
      for (const car of this.patrol) {
        const dx = p.x - car.x;
        const dz = p.z - car.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, dh * 1.4));
        const throttle = dist > 6 ? 1 : 0.3;
        driveCar(world, car, dt, { throttle, steer, handbrake: false });
        // Ramming the player on foot hurts.
        if (dist < 2.2 && p.mode === 'foot') {
          if (p.hurt(14)) game.onWasted();
          else {
            p.x += dx / (dist || 1) * 2;
            p.z += dz / (dist || 1) * 2;
          }
        }
        // Ramming the player's car slows both down.
        if (p.mode === 'car' && p.car && dist < 4.4) {
          car.speed *= 0.5;
          p.car.speed *= 0.7;
          this.addHeat(2);
        }
      }
      // Foot cops run at the player and arrest on contact.
      for (const cop of this.foot) {
        const dx = p.x - cop.x;
        const dz = p.z - cop.z;
        const dist = Math.hypot(dx, dz);
        cop.heading = Math.atan2(dx, dz);
        const speed = p.mode === 'car' ? 3.4 : 6.4;
        // A cop cannot arrest a driver: hold off clear of the car body.
        const holdOff = p.mode === 'car' ? 6.5 : 0;
        if (dist <= holdOff) {
          cop.mesh.position.set(cop.x, 0, cop.z);
          cop.mesh.rotation.y = cop.heading;
          continue;
        }
        const nx = cop.x + Math.sin(cop.heading) * speed * dt;
        const nz = cop.z + Math.cos(cop.heading) * speed * dt;
        const fixed = collideCircle(world, nx, nz, 0.5);
        cop.x = fixed.x;
        cop.z = fixed.z;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        if (dist < 1.4 && p.mode === 'foot') game.onBusted();
      }
      // Helicopter circles overhead.
      if (this.heli) {
        this.heli.angle += dt * 0.35;
        const hx = p.x + Math.sin(this.heli.angle) * 42;
        const hz = p.z + Math.cos(this.heli.angle) * 42;
        this.heli.mesh.position.set(hx, 58, hz);
        this.heli.mesh.rotation.y = this.heli.angle + Math.PI;
        this.heli.rotor.rotation.y += dt * 22;
      }
    },
  };
  return police;
}

export { CAR_CLASSES };
