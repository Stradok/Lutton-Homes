// Builds the request handler. Kept separate from server.js so tests can call it without opening a port.
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { listHomes } from './homes.js';
import { getProvider } from './payments.js';
import { createNotifier } from './notify.js';
import { log } from './log.js';
import { HttpError, applyCors, clientIp, rateLimiter, send } from './http.js';

// payments and notify are injectable so tests (and a future provider) can stand in; by default they come from the settings.
// refresh(slug, {wait}) re-reads one home's Airbnb and Booking.com calendars; the server passes a real one, tests pass none.
export function createApp({ config, store, payments = getProvider(config.paymentProvider), notify, refresh = async () => {} }) {
	const limit = rateLimiter(10, 60_000);
	const loginLimit = rateLimiter(5, 60_000);
	const anyLimit = rateLimiter(300, 60_000); // a generous ceiling on everything, so one address cannot flood the server
	const getHomes = () => listHomes(store, config.seedHomes ?? config.homes);
	notify ??= createNotifier({ mailer: config.mailProvider, ownerEmail: config.ownerEmail, homes: getHomes });
	const deps = { config, store, payments, notify, getHomes, refresh };
	const routes = [...publicRoutes({ ...deps, limit }), ...adminRoutes({ ...deps, loginLimit })];

	return async function handle(req, res) {
		try {
			applyCors(req, res, config.allowedOrigins);
			if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
			if (!anyLimit(clientIp(req, config.trustProxy))) throw new HttpError(429, 'Too many requests, try again in a minute');
			const url = new URL(req.url, 'http://localhost');
			for (const [method, pattern, fn] of routes) {
				const m = method === req.method && url.pathname.match(pattern);
				if (m) return await fn(req, res, m.slice(1), url);
			}
			throw new HttpError(404, 'Not found');
		} catch (err) {
			const status = err instanceof HttpError ? err.status : 500;
			if (status === 500) log.error('request failed', { method: req.method, path: req.url.split('?')[0], err });
			send(res, status, { error: status === 500 ? 'Something went wrong' : err.message, code: err.code });
		}
	};
}
