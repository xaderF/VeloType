// ---------------------------------------------------------------------------
// Per-connection WebSocket message rate limiter (token bucket algorithm)
// ---------------------------------------------------------------------------

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new WeakMap<object, RateBucket>();

const DEFAULT_MAX_TOKENS = 30;       // burst capacity
const DEFAULT_REFILL_RATE = 10;      // tokens per second
const DEFAULT_REFILL_INTERVAL = 1000; // ms

/**
 * Returns `true` if the message should be **allowed**, `false` if rate-limited.
 *
 * Each WebSocket connection gets its own token bucket. Tokens refill at
 * `refillRate` per second up to `maxTokens`. Every message consumes 1 token.
 */
export function wsRateLimitAllow(
  socket: object,
  maxTokens = DEFAULT_MAX_TOKENS,
  refillRate = DEFAULT_REFILL_RATE,
): boolean {
  const now = Date.now();

  let bucket = buckets.get(socket);
  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(socket, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= DEFAULT_REFILL_INTERVAL) {
    const intervalsElapsed = Math.floor(elapsed / DEFAULT_REFILL_INTERVAL);
    bucket.tokens = Math.min(maxTokens, bucket.tokens + intervalsElapsed * refillRate);
    bucket.lastRefill += intervalsElapsed * DEFAULT_REFILL_INTERVAL;
  }

  if (bucket.tokens <= 0) return false;

  bucket.tokens -= 1;
  return true;
}
