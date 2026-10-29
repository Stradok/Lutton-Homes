// Settings come from environment variables so no secret is ever committed. Homes (slug, name, rate) are read from the
// website's own data file, so there is one list of properties for the site and the API.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseOwners } from './auth.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const envKey = (slug) => slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');

export function loadConfig(env = process.env) {
	const { homes } = JSON.parse(readFileSync(env.HOMES_FILE || here('../../../site/data/homes.json'), 'utf8'));
	return {
		port: Number(env.PORT) || 8787,
		seedHomes: homes, // the website's own properties, used until an owner changes them
		uploadsDir: env.UPLOADS_DIR || here('../data/uploads'),
		apiUrl: (env.API_PUBLIC_URL || '').replace(/\/$/, ''), // this API's public address, put in front of uploaded photo links
		deployHook: env.DEPLOY_HOOK_URL || '', // a POST to this address rebuilds the static website (a Vercel deploy hook)
		dataFile: env.DATA_FILE || here('../data/store.json'),
		adminToken: env.ADMIN_TOKEN || '',
		owners: parseOwners(env.OWNERS), // owner sign-in accounts, "name:hash,name:hash"
		sessionSecret: env.SESSION_SECRET || '',
		holdMinutes: Number(env.HOLD_MINUTES) || 30, // how long an unpaid request holds its nights
		siteUrl: env.SITE_URL || '',
		paymentProvider: env.PAYMENT_PROVIDER || 'manual',
		mailProvider: env.MAIL_PROVIDER || 'log',
		ownerEmail: env.OWNER_EMAIL || '',
		icalToken: env.ICAL_TOKEN || '',
		allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
		trustProxy: env.TRUST_PROXY === '1',
		syncMinutes: Number(env.SYNC_MINUTES) || 5,
		homes: homes.map((h) => ({
			slug: h.slug, name: h.name, rate: h.rate, sleeps: h.sleeps,
			// Each owner pastes the "export calendar" link from Airbnb and Booking.com into these variables.
			feeds: { airbnb: env['FEED_AIRBNB_' + envKey(h.slug)] || '', booking: env['FEED_BOOKING_' + envKey(h.slug)] || '' },
		})),
	};
}
