// seed.ts — server-side copy of client engine seed logic
// Deterministic PRNG for reproducible text generation

function hashSeed(seed: string | number): number {
  const input = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0 || 0x9e3779b9;
}

export function makeRng(seed: string | number): () => number {
  let state = hashSeed(seed);

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const unsigned = state >>> 0;
    return unsigned / 0xffffffff;
  };
}
