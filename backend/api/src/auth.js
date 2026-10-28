// Owner accounts: scrypt password hashes and signed, expiring session tokens. No dependencies.
// Accounts live in the OWNERS setting as "name:hash,name:hash"; make a hash with `npm run hash-password`.
import { randomBytes, scryptSync, createHmac, createHash } from 'node:crypto';
import { safeEqual } from './http.js';

const b64 = (s) => Buffer.from(s).toString('base64url');

export function hashPassword(password) {
	const salt = randomBytes(16).toString('hex');
	return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('hex')}`;
}

export function verifyPassword(password, stored) {
	const [kind, salt, hash] = String(stored).split('$');
	if (kind !== 'scrypt' || !salt || !hash) return false;
	return safeEqual(scryptSync(String(password), salt, 32).toString('hex'), hash);
}

export function parseOwners(text = '') {
	return Object.fromEntries(text.split(',').map((p) => p.trim()).filter(Boolean).map((p) => [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)]));
}

// Tied to the stored password hash, so changing a password (or removing an owner) ends that owner's old sessions.
export const fingerprint = (stored) => createHash('sha256').update(String(stored)).digest('hex').slice(0, 16);

// A session is "payload.signature"; the payload carries the owner, a password fingerprint and the expiry, so the server keeps no session table.
export function signSession(user, secret, stored, ttlMs = 12 * 3600_000, now = Date.now()) {
	const body = b64(JSON.stringify({ u: user, f: fingerprint(stored), exp: now + ttlMs }));
	return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

// Returns the owner's name when the token is genuine, unexpired and still matches that owner's current password hash.
export function verifySession(token, secret, owners = {}, now = Date.now()) {
	const [body, sig] = String(token).split('.');
	if (!secret || !body || !sig || !safeEqual(createHmac('sha256', secret).update(body).digest('base64url'), sig)) return null;
	try {
		const { u, f, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
		return exp > now && Object.hasOwn(owners, u) && f === fingerprint(owners[u]) ? u : null;
	} catch { return null; }
}
