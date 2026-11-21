// Solmar City: the world. A 12x12 block grid of procedural buildings on a
// painted ground plane (roads, sidewalks, beach, sea), plus street props.
// Everything is generated from the seeded rng, so the same seed builds the
// same city. No external assets, no network requests.
import * as THREE from 'three';
import { BLOCK, CITY, GRID, PALETTE, PITCH, ROAD, SEA_Z, SHOPS, STREETS } from './config.js';
import { int, pick, range } from './random.js';

// Road centreline coordinate for grid line i (0..GRID).
export function roadCoord(i) {
  return -CITY / 2 + ROAD / 2 + i * PITCH;
}

// Nearest road centreline to a coordinate.
export function nearestRoadCoord(v) {
  return roadCoord(Math.round((v + CITY / 2 - ROAD / 2) / PITCH));
}

// Is this point on a road (within the asphalt)?
export function onRoad(x, z) {
  const fx = ((x + CITY / 2 - ROAD / 2) % PITCH + PITCH) % PITCH;
  const fz = ((z + CITY / 2 - ROAD / 2) % PITCH + PITCH) % PITCH;
  return fx < ROAD || fz < ROAD;
}

// Paint the whole ground (roads, lane dashes, sidewalks, beach, sea, parks)
// onto one canvas texture. One draw call for the entire ground.
function paintGround(rng) {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + CITY / 2 + 60) / (CITY + 120)) * S;

  // Base: grass-green city floor.
  g.fillStyle = '#6f9e57';
  g.fillRect(0, 0, S, S);

  // Sea (south edge) and sand beach.
  const seaY = toPx(SEA_Z - 26);
  g.fillStyle = PALETTE.sea;
  g.fillRect(0, seaY, S, S - seaY);
  g.fillStyle = PALETTE.sand;
  g.fillRect(0, seaY - toPx(0) * 0 - 26 * (S / (CITY + 120)), S, 26 * (S / (CITY + 120)));
  // Gentle wave lines on the sand.
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    const y = seaY + 8 + i * 9;
    g.beginPath();
    for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x / 90 + i * 2) * 4);
    g.stroke();
  }

  // Blocks: sidewalk slabs, some turned into parks.
  for (let bx = 0; bx < GRID; bx += 1) {
    for (let bz = 0; bz < GRID; bz += 1) {
      const x0 = roadCoord(bx) + ROAD / 2;
      const z0 = roadCoord(bz) + ROAD / 2;
      const w = BLOCK;
      const px = toPx(x0);
      const py = toPx(z0);
      const pw = (w / (CITY + 120)) * S;
      const isPark = rng() < 0.14;
      g.fillStyle = isPark ? '#5d9b4a' : PALETTE.sidewalk;
      g.fillRect(px, py, pw, pw);
      if (isPark) {
        // Park trees as dark green dots.
        g.fillStyle = '#3f7a34';
        for (let t = 0; t < 9; t += 1) {
          g.beginPath();
          g.arc(px + rng() * pw, py + rng() * pw, 7 + rng() * 8, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        // Sidewalk slab seams.
        g.strokeStyle = 'rgba(0,0,0,0.12)';
        g.lineWidth = 1;
        for (let s = 1; s < 4; s += 1) {
          g.beginPath(); g.moveTo(px + (pw * s) / 4, py); g.lineTo(px + (pw * s) / 4, py + pw); g.stroke();
          g.beginPath(); g.moveTo(px, py + (pw * s) / 4); g.lineTo(px + pw, py + (pw * s) / 4); g.stroke();
        }
      }
    }
  }

  // Roads: asphalt strips along every grid line, with centre dashes.
  g.fillStyle = PALETTE.asphalt;
  const rw = (ROAD / (CITY + 120)) * S;
  for (let i = 0; i <= GRID; i += 1) {
    const p = toPx(roadCoord(i) - ROAD / 2);
    g.fillRect(p, 0, rw, toPx(SEA_Z - 26));
    g.fillRect(0, p, S, rw);
  }
  g.fillStyle = '#e8d44d';
  const dash = 14;
  const gap = 18;
  for (let i = 0; i <= GRID; i += 1) {
    const p = toPx(roadCoord(i));
    for (let d = 0; d < S; d += dash + gap) {
      g.fillRect(d, p - 2, dash, 4);
      g.fillRect(p - 2, d, 4, dash);
    }
  }
  // Crosswalks at the four central intersections.
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [ix, iz] of [[5, 5], [6, 5], [5, 6], [6, 6]]) {
    const cx = toPx(roadCoord(ix));
    const cz = toPx(roadCoord(iz));
    for (let s = -3; s <= 3; s += 1) {
      g.fillRect(cx - 16 + s * 9, cz - ROAD * 0.5 * (S / (CITY + 120)) + 4, 5, 12);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// One procedural building facade texture (windows + sign band), reused.
function makeFacadeTextures(rng) {
  const variants = [];
  const hues = ['#d8c9a3', '#c9d6dd', '#e0b48f', '#b9c4b2', '#d9a0a0', '#a8b8d8'];
  for (let v = 0; v < 4; v += 1) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = hues[v % hues.length];
    g.fillRect(0, 0, 128, 256);
    // Window grid.
    const cols = 4;
    const rows = 10;
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        const lit = rng() < 0.35;
        g.fillStyle = lit ? '#ffe9a8' : '#5a6d7d';
        g.fillRect(10 + x * 28, 14 + y * 23, 18, 14);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(10 + x * 28, 14 + y * 23, 18, 3);
      }
    }
    // Ground-floor shop band with a fictional sign.
    g.fillStyle = '#2b2f38';
    g.fillRect(0, 232, 128, 24);
    g.fillStyle = pick(rng, ['#ffd34d', '#7ee0a3', '#ff8fa3', '#8fd0ff']);
    g.font = 'bold 13px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(pick(rng, SHOPS).toUpperCase().slice(0, 12), 64, 249);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    variants.push(tex);
  }
  return variants;
}

// A simple palm tree (trunk + fronds) for the beach and parks.
function makePalm(matTrunk, matLeaf) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 4.4, 6), matTrunk);
  trunk.position.y = 2.2;
  palm.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), matLeaf);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.0, 4.6, Math.sin(a) * 1.0);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    palm.add(leaf);
  }
  return palm;
}

export function createWorld(seed) {
  const rng = (function make(seedValue) {
    let a = seedValue | 0;
    return function random() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(seed);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyDay);
  scene.fog = new THREE.Fog(0x9fc8e8, 220, 900);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.0);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  // Fill light from the opposite side so shade-side facades stay readable.
  const fill = new THREE.DirectionalLight(0xcfe4ff, 0.55);
  fill.position.set(-140, 120, -90);
  scene.add(fill);

  const group = new THREE.Group();
  scene.add(group);

  // Ground plane with the painted city.
  const groundTex = paintGround(rng);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY + 120, CITY + 120),
    new THREE.MeshLambertMaterial({ map: groundTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 30);
  group.add(ground);

  // Buildings, one per block quadrant (skipping parks and the harbour strip).
  const facades = makeFacadeTextures(rng);
  const facadeMats = facades.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4d55 });
  const colliders = [];
  const buildingSpots = [];
  for (let bx = 0; bx < GRID; bx += 1) {
    for (let bz = 0; bz < GRID; bz += 1) {
      // Harbour strip: the southernmost row stays open for the port.
      if (bz === GRID - 1) continue;
      const x0 = roadCoord(bx) + ROAD / 2;
      const z0 = roadCoord(bz) + ROAD / 2;
      // Parks stay empty (matches the painted ground).
      if (((bx * 7 + bz * 13) % 23) < 3) continue;
      const count = int(rng, 1, 2);
      for (let k = 0; k < count; k += 1) {
        const w = range(rng, 12, 20);
        const d = range(rng, 12, 20);
        const h = range(rng, 9, bz < 3 ? 55 : 26);
        const x = x0 + (k === 0 ? 11 : BLOCK - 11) + range(rng, -2, 2);
        const z = z0 + BLOCK / 2 + range(rng, -8, 8);
        const mat = facadeMats[Math.floor(rng() * facadeMats.length)];
        // Sides wear the facade; top and bottom get a plain roof so the
        // city reads correctly from a high camera.
        const mats = [mat, mat, roofMat, roofMat, mat, mat];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
        mesh.position.set(x, h / 2, z);
        group.add(mesh);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.2, d * 0.5), roofMat);
        roof.position.set(x, h + 0.6, z);
        group.add(roof);
        // Neon sign strip on taller towers.
        if (h > 30) {
          const neon = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.7, 1.6, 0.3),
            new THREE.MeshBasicMaterial({ color: pick(rng, [0xff5d8f, 0x35d0ff, 0xffd34d, 0x7dff9e]) }),
          );
          neon.position.set(x, h - 3, z + d / 2 + 0.2);
          group.add(neon);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        buildingSpots.push({ x, z, w, h });
      }
    }
  }

  // Street props: lamps along roads, palms on the beach, a lighthouse.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let i = 0; i <= GRID; i += 1) {
    for (let j = 2; j < GRID; j += 3) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), lampMat);
      pole.position.set(roadCoord(i) + ROAD / 2 + 0.6, 2.7, roadCoord(j));
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampGlowMat);
      lamp.position.set(roadCoord(i) + ROAD / 2 + 0.6, 5.5, roadCoord(j));
      group.add(lamp);
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const palm = makePalm(palmTrunk, palmLeaf);
    palm.position.set(-CITY / 2 + 20 + i * 46 + range(rng, -8, 8), 0, SEA_Z - 18);
    group.add(palm);
  }
  // Lighthouse at the harbour corner.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
  const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.2, 26, 10), lightMat);
  lighthouse.position.set(CITY / 2 - 20, 13, SEA_Z - 30);
  group.add(lighthouse);
  const lightTop = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd34d }),
  );
  lightTop.position.set(CITY / 2 - 20, 27.5, SEA_Z - 30);
  group.add(lightTop);

  // Mission spots (fixed, named places on the map).
  const spots = {
    garage: { x: roadCoord(2), z: roadCoord(2), label: 'Bengkel Marlin' },
    warehouse: { x: roadCoord(6), z: roadCoord(1), label: 'Gudang Utara' },
    store: { x: roadCoord(4), z: roadCoord(5), label: 'Toko Sol' },
    harbor: { x: roadCoord(8), z: SEA_Z - 34, label: 'Dermaga 7' },
    hideout: { x: roadCoord(1), z: roadCoord(9), label: 'Rumah Jay' },
    hospital: { x: roadCoord(10), z: roadCoord(3), label: 'RS Solmar' },
    courier: { x: roadCoord(7), z: roadCoord(7), label: 'Kurir kabur' },
  };

  // Mission marker beacons (tall glowing cylinders, toggled by missions.js).
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd34d, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const beacons = {};
  for (const [key, spot] of Object.entries(spots)) {
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 42, 12, 1, true), beaconMat.clone());
    beacon.position.set(spot.x, 21, spot.z);
    beacon.visible = false;
    group.add(beacon);
    beacons[key] = beacon;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(spot.x, 0.15, spot.z);
    ring.visible = false;
    group.add(ring);
    beacons[`${key}:ring`] = ring;
  }

  const world = {
    scene,
    group,
    sun,
    hemi,
    colliders,
    spots,
    beacons,
    timeOfDay: 0.32,
    rng,
    update(dt) {
      // Slow sun cycle: morning -> golden hour -> dusk.
      this.timeOfDay = (this.timeOfDay + dt / 600) % 1;
      const t = this.timeOfDay;
      const day = t < 0.55 ? 1 : t < 0.75 ? 1 - (t - 0.55) / 0.2 : 0;
      const warm = t >= 0.55 && t < 0.8 ? (t - 0.55) / 0.25 : 0;
      const sky = new THREE.Color(PALETTE.skyDay).lerp(new THREE.Color(PALETTE.skySunset), Math.min(1, warm));
      if (t >= 0.8) sky.lerp(new THREE.Color(PALETTE.skyNight), (t - 0.8) / 0.2);
      scene.background.copy(sky);
      scene.fog.color.copy(sky);
      sun.intensity = 0.4 + 1.3 * day;
      sun.position.set(Math.cos(t * Math.PI * 2) * 160, 90 + 110 * day, 60 + Math.sin(t * Math.PI * 2) * 80);
      hemi.intensity = 0.5 + 0.5 * day;
      // Beacon pulse (sim time, so staged scenes stay deterministic).
      this.pulseTime = (this.pulseTime || 0) + dt;
      const pulse = 0.28 + 0.14 * Math.sin(this.pulseTime * 4);
      for (const b of Object.values(beacons)) {
        if (b.visible && b.geometry.type === 'CylinderGeometry') b.material.opacity = pulse;
      }
    },
  };
  return world;
}

// Axis-aligned box collision: push a circle (x, z, radius) out of buildings.
export function collideCircle(world, x, z, radius) {
  let nx = x;
  let nz = z;
  for (const b of world.colliders) {
    const cx = Math.max(b.minX, Math.min(nx, b.maxX));
    const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * radius;
        nz = cz + (dz / d) * radius;
      } else {
        nx = b.maxX + radius;
      }
    }
  }
  // Keep inside the city + beach.
  nx = Math.max(-CITY / 2 - 40, Math.min(CITY / 2 + 40, nx));
  nz = Math.max(-CITY / 2 - 40, Math.min(SEA_Z - 6, nz));
  return { x: nx, z: nz };
}

export { STREETS };
