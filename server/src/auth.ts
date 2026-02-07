import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const DEV_FALLBACK_SECRET = 'velotype-dev-secret-change-me';

type TokenPayload = {
  sub: string;
  username: string;
  iat: number;
  exp: number;
};

export type AuthUser = {
  id: string;
  username: string;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getTokenSecret() {
  return env.AUTH_SECRET ?? DEV_FALLBACK_SECRET;
}

function sign(data: string) {
  return createHmac('sha256', getTokenSecret()).update(data).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, expectedHash] = passwordHash.split(':');
  if (!salt || !expectedHash) return false;
  const actualHash = scryptSync(password, salt, 64).toString('hex');
  return safeEqual(actualHash, expectedHash);
}

export function createAuthToken(user: AuthUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: user.id,
    username: user.username,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${header}.${encodedPayload}`);
  return `${header}.${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string): AuthUser | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expectedSignature = sign(`${header}.${payload}`);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as TokenPayload;
    if (typeof decoded.sub !== 'string' || typeof decoded.username !== 'string' || typeof decoded.exp !== 'number') {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) return null;
    return { id: decoded.sub, username: decoded.username };
  } catch {
    return null;
  }
}

export function getBearerToken(authorization?: string) {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

