// Builds the request handler. Kept separate from server.js so tests can call it without opening a port.
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { getProvider } from './payments.js';
import { createNotifier } from './notify.js';
import { HttpError, applyCors, rateLimiter, send } from './http.js';

// payments and notify are injectable so tests (and a future provider) can stand in; by default they come from the settings.
export function createApp({ config, store, payments = getProvider(config.paymentProvider), notify = createNotifier({ mailer: config.mailProvider, ownerEmail: config.ownerEmail, homes: config.homes }) }) {
	const limit = rateLimiter(10, 60_000);
	const loginLimit = rateLimiter(5, 60_000);
	const deps = { config, store, payments, notify };
	const routes = [...publicRoutes({ ...deps, limit }), ...adminRoutes({ ...deps, loginLimit })];

	return async function handle(req, res) {
		try {
			applyCors(req, res, config.allowedOrigins);
			if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
			const url = new URL(req.url, 'http://localhost');
			for (const [method, pattern, fn] of routes) {
				const m = method === req.method && url.pathname.match(pattern);
				if (m) return await fn(req, res, m.slice(1), url);
			}
			throw new HttpError(404, 'Not found');
		} catch (err) {
			const status = err instanceof HttpError ? err.status : 500;
			if (status === 500) console.error(err);
			send(res, status, { error: status === 500 ? 'Something went wrong' : err.message, code: err.code });
		}
	};
}
