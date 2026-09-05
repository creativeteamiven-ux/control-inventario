import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

/** Challenges WebAuthn en memoria (TTL corto; suficiente en una instancia Render). */
type ChallengeEntry = { challenge: string; userId: string; expiresAt: number };

const store = new Map<string, ChallengeEntry>();
const TTL_MS = 5 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}

export function saveChallenge(key: string, challenge: string, userId: string) {
  prune();
  store.set(key, { challenge, userId, expiresAt: Date.now() + TTL_MS });
}

export function takeChallenge(key: string, userId: string): string | null {
  prune();
  const entry = store.get(key);
  if (!entry || entry.userId !== userId) return null;
  store.delete(key);
  if (entry.expiresAt < Date.now()) return null;
  return entry.challenge;
}

export function getWebAuthnConfig() {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  let rpID = process.env.WEBAUTHN_RP_ID || '';
  let origin = process.env.WEBAUTHN_ORIGIN || clientUrl;
  try {
    const u = new URL(clientUrl);
    if (!rpID) rpID = u.hostname;
    if (!process.env.WEBAUTHN_ORIGIN) origin = u.origin;
  } catch {
    if (!rpID) rpID = 'localhost';
  }
  const rpName = process.env.WEBAUTHN_RP_NAME || 'The Warehouse';
  return { rpID, rpName, origin };
}

export function parseTransports(raw: string | null | undefined): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed as AuthenticatorTransportFuture[];
  } catch {
    return undefined;
  }
}
