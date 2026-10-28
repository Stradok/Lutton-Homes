// Small HTTP helpers shared by the routes: JSON replies, body reading, CORS and the admin token check.
import { timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
	constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function send(res, status, body, headers = {}) {
	const isText = typeof body === 'string';
	res.writeHead(status, { 'content-type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
	res.end(isText ? body : JSON.stringify(body));
}

// The raw bytes matter for webhooks: a provider signs the exact body it sent.
export async function readRaw(req, limit = 20_000) {
	const chunks = []; let size = 0;
	for await (const c of req) {
		size += c.length;
		if (size > limit) throw new HttpError(413, 'Request is too large');
		chunks.push(c);
	}
	return Buffer.concat(chunks);
}

export async function readJson(req, limit) {
	let body;
	try { body = JSON.parse((await readRaw(req, limit)).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'Body must be JSON'); }
	if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Body must be a JSON object');
	return body;
}

// Behind a proxy every visitor shares the proxy's address, so the real one comes from X-Forwarded-For. Only trusted when TRUST_PROXY is set.
// The LAST entry is the one our own proxy appended; earlier entries are whatever the client sent, so they can be faked.
export function clientIp(req, trustProxy) {
	const fwd = trustProxy && String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
	return fwd || req.socket.remoteAddress || 'unknown';
}

export function applyCors(req, res, allowed) {
	const origin = req.headers.origin;
	if (origin && allowed.includes(origin)) {
		res.setHeader('access-control-allow-origin', origin);
		res.setHeader('vary', 'Origin');
		res.setHeader('access-control-allow-headers', 'content-type, authorization');
		res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
	}
}

// Constant-time comparison so a wrong token takes as long to reject as a nearly right one.
export function safeEqual(a, b) {
	const x = Buffer.from(String(a)), y = Buffer.from(String(b));
	return x.length === y.length && timingSafeEqual(x, y);
}

export function requireAdmin(req, token) {
	if (!token) throw new HttpError(503, 'Admin access is not configured on this server');
	const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
	if (!safeEqual(given, token)) throw new HttpError(401, 'Not signed in');
}

// Fixed-window limiter per address: enough to stop a script hammering the booking endpoint.
export function rateLimiter(max, windowMs) {
	const hits = new Map();
	return (key) => {
		const now = Date.now(), h = hits.get(key);
		if (!h || now - h.start > windowMs) { hits.set(key, { start: now, n: 1 }); return true; }
		h.n += 1;
		if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
		return h.n <= max;
	};
}
