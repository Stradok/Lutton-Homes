// Builds the request handler. Kept separate from server.js so tests can call it without opening a port.
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { HttpError, applyCors, rateLimiter, send } from './http.js';

export function createApp({ config, store }) {
	const limit = rateLimiter(10, 60_000);
	const routes = [...publicRoutes({ config, store, limit }), ...adminRoutes({ config, store })];

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
