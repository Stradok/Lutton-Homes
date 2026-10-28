// Owner routes. Every one needs the admin token (Authorization: Bearer ...).
import { buildReport, toCsv } from '../reports.js';
import { syncAll, syncStatus } from '../sync.js';
import { HttpError, readJson, requireAdmin, send } from '../http.js';
import { isIsoDate } from '../shapes.js';

const opt = (v) => (isIsoDate(v) ? v : undefined);

export function adminRoutes({ config, store }) {
	const guard = (fn) => async (req, res, m, url) => { requireAdmin(req, config.adminToken); return fn(req, res, m, url); };
	const homesList = config.homes.map(({ slug, name }) => ({ slug, name }));

	return [
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
		['POST', /^\/api\/admin\/bookings\/([^/]+)\/cancel$/, guard(async (req, res, [raw]) => {
			const id = decodeURIComponent(raw); // imported ids look like abc@airbnb.com
			const updated = await store.update(id, { status: 'cancelled' });
			if (!updated) throw new HttpError(404, 'No such booking');
			send(res, 200, updated);
		})],
		['POST', /^\/api\/admin\/sync$/, guard(async (req, res) => send(res, 200, await syncAll({ store, homes: config.homes })))],
		['GET', /^\/api\/admin\/sync-status$/, guard(async (req, res) => send(res, 200, await syncStatus({ store, homes: config.homes })))],
	];
}
