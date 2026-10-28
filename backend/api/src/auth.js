// Owner accounts: scrypt password hashes and signed, expiring session tokens. No dependencies.
// Accounts live in the OWNERS setting as "name:hash,name:hash"; make a hash with `npm run hash-password`.
import { randomBytes, scryptSync, createHmac } from 'node:crypto';
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

// A session is "payload.signature"; the payload carries the owner and the expiry, so the server keeps no session table.
export function signSession(user, secret, ttlMs = 12 * 3600_000, now = Date.now()) {
	const body = b64(JSON.stringify({ u: user, exp: now + ttlMs }));
	return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function verifySession(token, secret, now = Date.now()) {
	const [body, sig] = String(token).split('.');
	if (!secret || !body || !sig || !safeEqual(createHmac('sha256', secret).update(body).digest('base64url'), sig)) return null;
	try {
		const { u, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
		return exp > now ? u : null;
	} catch { return null; }
}
