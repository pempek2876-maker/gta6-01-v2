// Seeded random numbers (mulberry32) for Solmar City.
// The same seed always builds the same city, the same traffic and the same
// screenshot scenes, which is what makes ?shot= scenes repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one entry of an array with a seeded rng.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

// Integer in [min, max] from a seeded rng.
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Float in [min, max) from a seeded rng.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Deterministic string hash -> 32-bit seed (for naming things from text).
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
