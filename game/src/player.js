// Jay Marlowe on foot: WASD movement with a mouse-orbit third-person
// camera, run, jump, and entering / leaving cars (E). The camera itself is
// positioned by main.js from the yaw/pitch this module owns.
import * as THREE from 'three';
import { PALETTE, PISTOL, PLAYER } from './config.js';
import { collideCircle } from './world.js';

function buildPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: PALETTE.playerJacket });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
  const cap = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 0.28), jeans);
  legs.position.y = 0.42;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.32), jacket);
  torso.position.y = 1.18;
  group.add(torso);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.2), jacket);
  armL.position.set(-0.38, 1.16, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.2), jacket);
  armR.position.set(0.38, 1.16, 0);
  group.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.72;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12), cap);
  hat.position.y = 1.9;
  group.add(hat);
  return group;
}

export function createPlayer(world, start) {
  const mesh = buildPlayerMesh();
  mesh.position.set(start.x, 0, start.z);
  world.scene.add(mesh);
  const player = {
    mesh,
    x: start.x,
    z: start.z,
    y: 0,
    vy: 0,
    heading: 0,
    camYaw: Math.PI,
    camPitch: 0.32,
    mode: 'foot',
    car: null,
    health: PLAYER.health,
    armor: PLAYER.armor,
    cash: 150,
    ammo: PISTOL.magSize,
    reloading: 0,
    fireCooldown: 0,
    speed: 0,
    grounded: true,
    // Returns the camera target (head position) for main.js.
    eye() {
      return { x: this.x, y: 1.7 + this.y, z: this.z };
    },
    hurt(amount) {
      let rest = amount;
      if (this.armor > 0) {
        const absorbed = Math.min(this.armor, rest * 0.6);
        this.armor -= absorbed;
        rest -= absorbed;
      }
      this.health -= rest;
      return this.health <= 0;
    },
    heal(amount) {
      this.health = Math.min(PLAYER.health, this.health + amount);
    },
    update(dt, input, game) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      if (this.reloading > 0) {
        this.reloading -= dt;
        if (this.reloading <= 0) this.ammo = PISTOL.magSize;
      }
      // Mouse orbit.
      const look = input.takeMouse();
      this.camYaw -= look.dx * 0.0032;
      this.camPitch = Math.max(-0.15, Math.min(0.85, this.camPitch + look.dy * 0.0028));

      if (this.mode === 'car') {
        // The car module moves the car; the player rides along.
        if (this.car) {
          this.x = this.car.x;
          this.z = this.car.z;
          this.heading = this.car.heading;
          this.mesh.visible = false;
          if (input.takePressed('KeyE')) game.exitCar();
        }
        return;
      }

      // On foot: WASD relative to the camera yaw.
      const fwd = { x: -Math.sin(this.camYaw), z: -Math.cos(this.camYaw) };
      const right = { x: -fwd.z, z: fwd.x };
      let mx = 0;
      let mz = 0;
      if (input.down('KeyW')) { mx += fwd.x; mz += fwd.z; }
      if (input.down('KeyS')) { mx -= fwd.x; mz -= fwd.z; }
      if (input.down('KeyA')) { mx -= right.x; mz -= right.z; }
      if (input.down('KeyD')) { mx += right.x; mz += right.z; }
      const len = Math.hypot(mx, mz);
      const running = input.down('ShiftLeft') || input.down('ShiftRight');
      const targetSpeed = len > 0 ? (running ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
      if (len > 0) {
        mx /= len;
        mz /= len;
        const wantHeading = Math.atan2(mx, mz);
        let dh = wantHeading - this.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.heading += dh * Math.min(1, 14 * dt);
      }
      const accel = len > 0 ? PLAYER.accel : PLAYER.friction;
      this.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - this.speed));
      const nx = this.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.z + Math.cos(this.heading) * this.speed * dt;
      const fixed = collideCircle(world, nx, nz, PLAYER.radius);
      this.x = fixed.x;
      this.z = fixed.z;

      // Jump + gravity.
      if (input.takePressed('Space') && this.grounded) {
        this.vy = PLAYER.jumpSpeed;
        this.grounded = false;
      }
      if (!this.grounded) {
        this.vy -= PLAYER.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.grounded = true;
        }
      }

      // Walk bob.
      const bob = this.speed > 0.5 ? Math.abs(Math.sin(game.time * 11)) * 0.06 : 0;
      this.mesh.visible = true;
      this.mesh.position.set(this.x, this.y + bob, this.z);
      this.mesh.rotation.y = this.heading;

      // Enter a nearby car.
      if (input.takePressed('KeyE')) game.tryEnterCar();
      // Reload.
      if (input.takePressed('KeyR') && this.ammo < PISTOL.magSize && this.reloading <= 0) {
        this.reloading = PISTOL.reloadSeconds;
      }
    },
  };
  return player;
}
