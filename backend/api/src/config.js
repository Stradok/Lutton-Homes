// Settings come from environment variables so no secret is ever committed. Homes (slug, name, rate) are read from the
// website's own data file, so there is one list of properties for the site and the API.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const envKey = (slug) => slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');

export function loadConfig(env = process.env) {
	const { homes } = JSON.parse(readFileSync(env.HOMES_FILE || here('../../../site/data/homes.json'), 'utf8'));
	return {
		port: Number(env.PORT) || 8787,
		dataFile: env.DATA_FILE || here('../data/store.json'),
		adminToken: env.ADMIN_TOKEN || '',
		icalToken: env.ICAL_TOKEN || '',
		allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
		trustProxy: env.TRUST_PROXY === '1',
		syncMinutes: Number(env.SYNC_MINUTES) || 15,
		homes: homes.map((h) => ({
			slug: h.slug, name: h.name, rate: h.rate, sleeps: h.sleeps,
			// Each owner pastes the "export calendar" link from Airbnb and Booking.com into these variables.
			feeds: { airbnb: env['FEED_AIRBNB_' + envKey(h.slug)] || '', booking: env['FEED_BOOKING_' + envKey(h.slug)] || '' },
		})),
	};
}
