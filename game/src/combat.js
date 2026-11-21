// Combat: Jay's pistol (hitscan ray from the camera), muzzle flash, and the
// rival gang members who appear in missions 3 and 5 — simple chase-and-shoot
// AI with deliberately poor aim so a new player can win.
import * as THREE from 'three';
import { PISTOL } from './config.js';
import { collideCircle } from './world.js';

// Ray vs sphere: returns the distance along the ray, or Infinity.
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const t = lx * dx + ly * dy + lz * dz;
  if (t < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - t * t;
  if (d2 > r * r) return Infinity;
  return t - Math.sqrt(r * r - d2);
}

function buildGangMesh() {
  const group = new THREE.Group();
  const purple = new THREE.MeshLambertMaterial({ color: 0x6b2d8f });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.82, 0.26),
    new THREE.MeshLambertMaterial({ color: 0x1c1c22 }));
  legs.position.y = 0.41;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.64, 0.3), purple);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.68;
  group.add(head);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.34), purple);
  band.position.y = 1.84;
  group.add(band);
  return group;
}

export function createCombat(world, rng, game) {
  const combat = {
    enemies: [],
    flash: 0,
    flashMesh: null,
    spawnGang(x, z, count) {
      for (let i = 0; i < count; i += 1) {
        const mesh = buildGangMesh();
        const gx = x + (rng() - 0.5) * 10;
        const gz = z + (rng() - 0.5) * 10;
        mesh.position.set(gx, 0, gz);
        world.scene.add(mesh);
        this.enemies.push({
          mesh, x: gx, z: gz, heading: 0, health: 100, shootTimer: 1 + rng(), alive: true,
        });
      }
    },
    clearEnemies() {
      for (const e of this.enemies) world.scene.remove(e.mesh);
      this.enemies = [];
    },
    // Fire the pistol from the camera through the crosshair.
    shoot() {
      const p = game.player;
      if (p.reloading > 0 || p.fireCooldown > 0 || p.ammo <= 0) return;
      p.ammo -= 1;
      p.fireCooldown = PISTOL.fireInterval;
      this.flash = 0.06;
      game.audio.gunshot();
      game.peds.scare(p.x, p.z, 30);
      game.police.addHeat(18);
      // Camera ray (through the centre of the screen).
      const cam = game.camera;
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const ox = cam.position.x;
      const oy = cam.position.y;
      const oz = cam.position.z;
      let best = PISTOL.range;
      let bestTarget = null;
      let bestKind = null;
      // Gang members (body sphere + head sphere).
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const tb = raySphere(ox, oy, oz, dir.x, dir.y, dir.z, e.x, 1.2, e.z, 0.55);
        const th = raySphere(ox, oy, oz, dir.x, dir.y, dir.z, e.x, 1.7, e.z, 0.28);
        if (th < best) { best = th; bestTarget = e; bestKind = 'head'; }
        else if (tb < best) { best = tb; bestTarget = e; bestKind = 'body'; }
      }
      // Foot cops (shooting a cop is a big crime).
      for (const cop of game.police.foot) {
        const t = raySphere(ox, oy, oz, dir.x, dir.y, dir.z, cop.x, 1.2, cop.z, 0.55);
        if (t < best) { best = t; bestTarget = cop; bestKind = 'cop'; }
      }
      // Cars (shooting a car damages it; a stopped NPC car can be stolen).
      for (const car of [...game.traffic.cars, ...game.traffic.parked, ...game.police.patrol]) {
        const t = raySphere(ox, oy, oz, dir.x, dir.y, dir.z, car.x, 0.8, car.z, 2.2);
        if (t < best) { best = t; bestTarget = car; bestKind = 'car'; }
      }
      if (bestTarget) {
        if (bestKind === 'head') {
          bestTarget.health -= PISTOL.headshot;
          game.hud.hitmarker(true);
        } else if (bestKind === 'body') {
          bestTarget.health -= PISTOL.damage;
          game.hud.hitmarker(false);
        } else if (bestKind === 'cop') {
          game.police.addHeat(45);
          game.hud.hitmarker(false);
          // Cops do not die from one hit; they keep coming.
          game.say('Kau menembak polisi! Wanted naik drastis.');
        } else if (bestKind === 'car') {
          bestTarget.speed = Math.max(0, bestTarget.speed - 6);
          game.hud.hitmarker(false);
        }
        if (bestTarget.health !== undefined && bestTarget.health <= 0 && bestTarget.alive) {
          bestTarget.alive = false;
          world.scene.remove(bestTarget.mesh);
          game.stats.kills += 1;
        }
      }
    },
    update(dt) {
      const p = game.player;
      if (this.flash > 0) this.flash -= dt;
      // Gang AI: close in, then shoot with bad aim.
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const dist = Math.hypot(dx, dz);
        e.heading = Math.atan2(dx, dz);
        if (dist > 14) {
          const nx = e.x + Math.sin(e.heading) * 4.4 * dt;
          const nz = e.z + Math.cos(e.heading) * 4.4 * dt;
          const fixed = collideCircle(world, nx, nz, 0.5);
          e.x = fixed.x;
          e.z = fixed.z;
        } else {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = 1.1 + rng() * 0.9;
            // Poor aim: hits only about 1 in 4 shots.
            if (rng() < 0.25 && p.mode === 'foot') {
              if (p.hurt(9)) game.onWasted();
            }
            game.audio.enemyShot();
          }
        }
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = e.heading;
      }
    },
  };
  return combat;
}
