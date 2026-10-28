// Public routes: what the website calls. They never reveal guest details or which site a booking came from.
import { availabilityMap, bookedRanges, isRangeFree } from '../availability.js';
import { buildIcal } from '../ical.js';
import { HttpError, clientIp, readJson, safeEqual, send } from '../http.js';
import { isIsoDate, dayNumber } from '../shapes.js';
import { quote } from '../pricing.js';

const MAX_NIGHTS = 30;
const MAX_AHEAD_DAYS = 400;
const today = () => new Date().toISOString().slice(0, 10);

export function publicRoutes({ config, store, limit }) {
	const home = (slug) => {
		const h = config.homes.find((x) => x.slug === slug);
		if (!h) throw new HttpError(404, 'Unknown home');
		return h;
	};

	return [
		['GET', /^\/api\/health$/, async (req, res) => send(res, 200, { ok: true })],

		// Booked and free nights for one home, merged from direct bookings and the Airbnb and Booking.com feeds.
		['GET', /^\/api\/availability\/([a-z0-9-]+)$/, async (req, res, [slug], url) => {
			home(slug);
			const from = isIsoDate(url.searchParams.get('from')) ? url.searchParams.get('from') : today();
			const days = Math.min(Math.max(parseInt(url.searchParams.get('days'), 10) || 120, 1), 400);
			const blocks = await store.list();
			const { days: map } = availabilityMap(blocks, slug, from, days);
			send(res, 200, { home: slug, from, days: map, ranges: bookedRanges(blocks, slug).map(({ from: f, to }) => ({ from: f, to })) });
		}],

		// A guest booking direct. Rejects dates that overlap an existing stay on any channel.
		['POST', /^\/api\/bookings$/, async (req, res) => {
			if (!limit(clientIp(req, config.trustProxy))) throw new HttpError(429, 'Too many requests, try again in a minute');
			const b = await readJson(req);
			const h = home(b.home);
			if (!isIsoDate(b.from) || !isIsoDate(b.to) || b.to <= b.from || b.from < today()) throw new HttpError(400, 'Choose valid dates');
			const nights = dayNumber(b.to) - dayNumber(b.from);
			// One request must not be able to block a home for a year: cap the stay and how far ahead it starts.
			if (nights > MAX_NIGHTS) throw new HttpError(400, `Stays are limited to ${MAX_NIGHTS} nights online. Message us for longer.`);
			if (dayNumber(b.from) - dayNumber(today()) > MAX_AHEAD_DAYS) throw new HttpError(400, 'That date is too far ahead to book online');
			const guests = Number(b.guests);
			if (!Number.isInteger(guests) || guests < 1 || guests > h.sleeps) throw new HttpError(400, `Guests must be 1 to ${h.sleeps}`);
			const guest = String(b.name || '').trim().slice(0, 80);
			if (!guest) throw new HttpError(400, 'Name is required');
			if (!isRangeFree(await store.list(), h.slug, b.from, b.to)) throw new HttpError(409, 'Those dates are no longer available', 'OVERLAP');
			try {
				const block = await store.add({ home: h.slug, from: b.from, to: b.to, channel: 'direct', status: 'confirmed', guest, guests, total: quote(h.rate, nights).total });
				send(res, 201, { id: block.id, total: block.total, nights });
			} catch (err) {
				if (err.code === 'OVERLAP') throw new HttpError(409, 'Those dates are no longer available', 'OVERLAP');
				throw err;
			}
		}],

		// Calendar feed for Airbnb and Booking.com to import, so a direct booking blocks the same nights there.
		// ?for=airbnb leaves out Airbnb's own stays (it already has them); the token keeps the address private.
		['GET', /^\/api\/ical\/([a-z0-9-]+)\.ics$/, async (req, res, [slug], url) => {
			const h = home(slug);
			if (!config.icalToken || !safeEqual(url.searchParams.get('token') || '', config.icalToken)) throw new HttpError(401, 'Not allowed');
			const target = url.searchParams.get('for');
			const blocks = (await store.list()).filter((x) => x.home === slug && x.channel !== target);
			send(res, 200, buildIcal({ name: `${h.name} availability`, blocks }), { 'content-type': 'text/calendar; charset=utf-8' });
		}],
	];
}

