import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const COOKIE_NAME = 'cct_session';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

// A fixed-cost hash makes unknown-account authentication follow the same expensive path.
const dummyHash = hashPassword(randomBytes(32).toString('hex'));
export function verifyPassword(password, stored = dummyHash) {
  const [algorithm, salt, encoded] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  try {
    const expected = Buffer.from(encoded, 'hex');
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const csrfForToken = (token) => createHash('sha256').update(`cct:csrf:v1:${token}`).digest('hex');

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sessionCookie(req) {
  const cookie = req.headers.cookie || '';
  for (const part of cookie.split(';')) {
    const [name, ...pieces] = part.trim().split('=');
    if (name === COOKIE_NAME) {
      const token = pieces.join('=');
      return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
    }
  }
  return null;
}

export function createRateLimiter({ windowMs, limit, maxEntries = 10000 }) {
  const buckets = new Map();
  return function consume(key) {
    const now = Date.now();
    if (buckets.size >= maxEntries) {
      for (const [entryKey, value] of buckets) if (value.resetAt <= now) buckets.delete(entryKey);
      // Bound memory even during attacks involving many distinct identifiers.
      if (buckets.size >= maxEntries && !buckets.has(key)) {
        return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
      }
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  };
}
