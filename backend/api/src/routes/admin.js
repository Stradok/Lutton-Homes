// Owner routes. Every one needs the admin token (Authorization: Bearer ...).
import { buildReport, toCsv } from '../reports.js';
import { syncAll, syncStatus } from '../sync.js';
import { HttpError, clientIp, readJson, readRaw, requireAdmin, send } from '../http.js';
import { changeHomes, cleanHome } from '../homes.js';
import { MAX_BYTES, saveImage } from '../uploads.js';
import { makeReviewToken } from '../reviews.js';
import { holds } from '../availability.js';
import { signSession, verifyPassword, verifySession } from '../auth.js';
import { isIsoDate } from '../shapes.js';

const opt = (v) => (isIsoDate(v) ? v : undefined);

// A fixed hash to check against when the name is unknown, so a wrong name and a wrong password take equally long.
const DUMMY = 'scrypt$00$' + '0'.repeat(64);

export function adminRoutes({ config, store, notify, loginLimit, getHomes }) {
	// Either a signed-in owner's session or the service token (ADMIN_TOKEN) opens the owner routes.
	const guard = (fn) => async (req, res, m, url) => {
		const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
		if (!verifySession(given, config.sessionSecret, config.owners)) {
			if (config.adminToken) requireAdmin(req, config.adminToken);
			else throw new HttpError(config.sessionSecret ? 401 : 503, config.sessionSecret ? 'Not signed in' : 'Admin access is not configured on this server');
		}
		return fn(req, res, m, url);
	};

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
			const range = { from: opt(url.searchParams.get('from')), to: opt(url.searchParams.get('to')), homes: (await getHomes()).map(({ slug, name }) => ({ slug, name })) };
			const report = buildReport(await store.list(), range);
			if (url.searchParams.get('format') === 'csv') return send(res, 200, toCsv(report), { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="luton-homes-report.csv"' });
			send(res, 200, report);
		})],
		['GET', /^\/api\/admin\/bookings$/, guard(async (req, res) => {
			send(res, 200, (await store.list()).sort((a, b) => b.from.localeCompare(a.from)));
		})],
		['POST', /^\/api\/admin\/bookings$/, guard(async (req, res) => {
			const b = await readJson(req);
			if (!(await getHomes()).some((h) => h.slug === b.home)) throw new HttpError(400, 'Unknown home');
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
		// Properties: add, edit and remove. Changes show on the website after Publish rebuilds it.
		['POST', /^\/api\/admin\/homes$/, guard(async (req, res) => {
			const home = cleanHome(await readJson(req, 200_000));
			await changeHomes(store, config.seedHomes ?? config.homes, (cur) => {
				if (cur.some((h) => h.slug === home.slug)) throw new HttpError(409, 'A property with that name already exists');
				return { homes: [...cur, home], result: home };
			});
			send(res, 201, home);
		})],
		['PUT', /^\/api\/admin\/homes\/([a-z0-9-]+)$/, guard(async (req, res, [slug]) => {
			const input = await readJson(req, 200_000);
			const home = await changeHomes(store, config.seedHomes ?? config.homes, (cur) => {
				const old = cur.find((h) => h.slug === slug);
				if (!old) throw new HttpError(404, 'No such property');
				const next = cleanHome(input, old);
				return { homes: cur.map((h) => (h.slug === slug ? next : h)), result: next };
			});
			send(res, 200, home);
		})],
		['DELETE', /^\/api\/admin\/homes\/([a-z0-9-]+)$/, guard(async (req, res, [slug]) => {
			const today = new Date().toISOString().slice(0, 10);
			// The bookings check and the removal happen in one store step, so a booking cannot slip in between.
			await changeHomes(store, config.seedHomes ?? config.homes, (cur, blocks) => {
				if (blocks.some((b) => b.home === slug && b.to >= today && holds(b))) throw new HttpError(409, 'This property has current or future bookings. Cancel them first.');
				if (!cur.some((h) => h.slug === slug)) throw new HttpError(404, 'No such property');
				return { homes: cur.filter((h) => h.slug !== slug), result: true };
			});
			send(res, 200, { ok: true });
		})],

		// A photo: the request body is the image file itself. Returns the address to put in a room's photos.
		['POST', /^\/api\/admin\/uploads$/, guard(async (req, res) => {
			const name = await saveImage(config.uploadsDir, await readRaw(req, MAX_BYTES));
			send(res, 201, { url: `${config.apiUrl}/api/media/${name}` });
		})],

		// Reviews: make a one-use link for a guest, then publish or hide what comes back.
		['POST', /^\/api\/admin\/review-links$/, guard(async (req, res) => {
			const b = await readJson(req);
			if (!(await getHomes()).some((h) => h.slug === b.home)) throw new HttpError(400, 'Unknown home');
			send(res, 201, { token: makeReviewToken({ home: b.home, ref: String(b.ref || '').slice(0, 40) }, config.sessionSecret) });
		})],
		['GET', /^\/api\/admin\/reviews$/, guard(async (req, res) => send(res, 200, ((await store.meta('reviews')) ?? []).slice().reverse()))],
		...['publish', 'hide'].map((action) => ['POST', new RegExp(`^/api/admin/reviews/([a-f0-9-]+)/${action}$`), guard(async (req, res, [id]) => {
			let found;
			await store.mutate('reviews', (cur = []) => cur.map((r) => (r.id === id ? (found = { ...r, status: action === 'publish' ? 'published' : 'hidden' }) : r)));
			if (!found) throw new HttpError(404, 'No such review');
			send(res, 200, found);
		})]),

		// Rebuild the static website so it picks up property and review changes (needs DEPLOY_HOOK_URL).
		['POST', /^\/api\/admin\/publish$/, guard(async (req, res) => {
			if (!config.deployHook) throw new HttpError(503, 'Publishing is not connected. Set DEPLOY_HOOK_URL.');
			const r = await fetch(config.deployHook, { method: 'POST', signal: AbortSignal.timeout(10_000) }).catch(() => null);
			if (!r?.ok) throw new HttpError(502, 'The website rebuild could not be started');
			send(res, 200, { ok: true });
		})],
		['POST', /^\/api\/admin\/sync$/, guard(async (req, res) => send(res, 200, await syncAll({ store, homes: config.homes, notify })))],
		['GET', /^\/api\/admin\/conflicts$/, guard(async (req, res) => send(res, 200, (await store.meta('conflicts')) ?? []))],
		['GET', /^\/api\/admin\/sync-status$/, guard(async (req, res) => send(res, 200, await syncStatus({ store, homes: config.homes })))],
	];
}
