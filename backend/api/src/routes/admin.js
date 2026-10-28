// Owner routes. Every one needs the admin token (Authorization: Bearer ...).
import { buildReport, toCsv } from '../reports.js';
import { syncAll, syncStatus } from '../sync.js';
import { HttpError, clientIp, readJson, requireAdmin, send } from '../http.js';
import { signSession, verifyPassword, verifySession } from '../auth.js';
import { isIsoDate } from '../shapes.js';

const opt = (v) => (isIsoDate(v) ? v : undefined);

// A fixed hash to check against when the name is unknown, so a wrong name and a wrong password take equally long.
const DUMMY = 'scrypt$00$' + '0'.repeat(64);

export function adminRoutes({ config, store, notify, loginLimit }) {
	// Either a signed-in owner's session or the service token (ADMIN_TOKEN) opens the owner routes.
	const guard = (fn) => async (req, res, m, url) => {
		const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
		if (!verifySession(given, config.sessionSecret, config.owners)) {
			if (config.adminToken) requireAdmin(req, config.adminToken);
			else throw new HttpError(config.sessionSecret ? 401 : 503, config.sessionSecret ? 'Not signed in' : 'Admin access is not configured on this server');
		}
		return fn(req, res, m, url);
	};
	const homesList = config.homes.map(({ slug, name }) => ({ slug, name }));

	return [
		// Owner sign-in. Returns a session token that lasts 12 hours; send it as Authorization: Bearer <token>.
		['POST', /^\/api\/admin\/login$/, async (req, res) => {
			if (!config.sessionSecret) throw new HttpError(503, 'Sign-in is not configured on this server');
			if (!loginLimit(clientIp(req, config.trustProxy))) throw new HttpError(429, 'Too many attempts, try again in a minute');
			const { user, password } = await readJson(req);
			const stored = Object.hasOwn(config.owners, user) ? config.owners[user] : DUMMY;
			if (!verifyPassword(password, stored) || stored === DUMMY) throw new HttpError(401, 'That username or password is not right');
			send(res, 200, { token: signSession(user, config.sessionSecret, stored), user });
		}],
		// Where bookings came from: this website, Airbnb, Booking.com, or entered by hand.
		['GET', /^\/api\/admin\/report$/, guard(async (req, res, m, url) => {
			const range = { from: opt(url.searchParams.get('from')), to: opt(url.searchParams.get('to')), homes: homesList };
			const report = buildReport(await store.list(), range);
			if (url.searchParams.get('format') === 'csv') return send(res, 200, toCsv(report), { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="luton-homes-report.csv"' });
			send(res, 200, report);
		})],
		['GET', /^\/api\/admin\/bookings$/, guard(async (req, res) => {
			send(res, 200, (await store.list()).sort((a, b) => b.from.localeCompare(a.from)));
		})],
		['POST', /^\/api\/admin\/bookings$/, guard(async (req, res) => {
			const b = await readJson(req);
			if (!config.homes.some((h) => h.slug === b.home)) throw new HttpError(400, 'Unknown home');
			try { send(res, 201, await store.add({ home: b.home, from: b.from, to: b.to, channel: 'manual', status: 'confirmed', guest: String(b.guest || '').slice(0, 80) })); }
			catch (err) { throw err.code ? new HttpError(err.code === 'OVERLAP' ? 409 : 400, err.message, err.code) : err; }
		})],
		// Cancel, or confirm a pending request (owner approval, or a payment taken outside the website).
		...['cancel', 'confirm'].map((action) => ['POST', new RegExp(`^/api/admin/bookings/([^/]+)/${action}$`), guard(async (req, res, [raw]) => {
			const id = decodeURIComponent(raw); // imported ids look like abc@airbnb.com
			let updated;
			try { updated = await store.update(id, action === 'cancel' ? { status: 'cancelled' } : { status: 'confirmed', holdUntil: undefined }); }
			catch (err) { throw err.code ? new HttpError(err.code === 'OVERLAP' ? 409 : 400, err.message, err.code) : err; }
			if (!updated) throw new HttpError(404, 'No such booking');
			if (updated.channel === 'direct') await notify(action === 'cancel' ? 'cancelled' : 'confirmed', updated);
			send(res, 200, updated);
		})]),
		['POST', /^\/api\/admin\/sync$/, guard(async (req, res) => send(res, 200, await syncAll({ store, homes: config.homes })))],
		['GET', /^\/api\/admin\/sync-status$/, guard(async (req, res) => send(res, 200, await syncStatus({ store, homes: config.homes })))],
	];
}
