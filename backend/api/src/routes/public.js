// Public routes: what the website calls. They never reveal guest details or which site a booking came from.
import { availabilityMap, bookedRanges, isRangeFree } from '../availability.js';
import { buildIcal } from '../ical.js';
import { HttpError, clientIp, readJson, safeEqual, send } from '../http.js';
import { isIsoDate, dayNumber } from '../shapes.js';
import { quote } from '../pricing.js';
import { readRaw } from '../http.js';
import { log } from '../log.js';
import { readImage } from '../uploads.js';
import { cleanReview, publicView, readReviewToken } from '../reviews.js';
import { randomUUID } from 'node:crypto';

const MAX_NIGHTS = 30;
const MAX_AHEAD_DAYS = 400;
const today = () => new Date().toISOString().slice(0, 10);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function publicRoutes({ config, store, limit, payments, notify, getHomes, refresh }) {
	const home = async (slug) => {
		const h = (await getHomes()).find((x) => x.slug === slug);
		if (!h) throw new HttpError(404, 'Unknown home');
		return h;
	};

	return [
		// Reads the data file, so "ok" means the API can really answer. Says nothing about why when it cannot.
		['GET', /^\/api\/health$/, async (req, res) => {
			try { await store.list(); send(res, 200, { ok: true }); } catch { send(res, 503, { ok: false }); }
		}],

		// Booked and free nights for one home, merged from direct bookings and the Airbnb and Booking.com feeds.
		['GET', /^\/api\/availability\/([a-z0-9-]+)$/, async (req, res, [slug], url) => {
			await home(slug);
			refresh(slug); // refresh in the background; this answer uses the copy we already have
			const from = isIsoDate(url.searchParams.get('from')) ? url.searchParams.get('from') : today();
			const days = Math.min(Math.max(parseInt(url.searchParams.get('days'), 10) || 120, 1), 400);
			const blocks = await store.list();
			const { days: map } = availabilityMap(blocks, slug, from, days);
			send(res, 200, { home: slug, from, days: map, ranges: bookedRanges(blocks, slug).map(({ from: f, to }) => ({ from: f, to })) });
		}],

		// The properties, as the website shows them.
		['GET', /^\/api\/homes$/, async (req, res) => send(res, 200, await getHomes())],
		['GET', /^\/api\/homes\/([a-z0-9-]+)$/, async (req, res, [slug]) => send(res, 200, await home(slug))],

		// Uploaded photos. The file name is a random id and the type is checked again on the way out.
		['GET', /^\/api\/media\/([a-z0-9.]+)$/, async (req, res, [name]) => {
			const { bytes, mime } = await readImage(config.uploadsDir, name);
			res.writeHead(200, { 'content-type': mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'cross-origin' });
			res.end(bytes);
		}],

		// Published reviews only.
		['GET', /^\/api\/reviews$/, async (req, res, m, url) => {
			const homeSlug = url.searchParams.get('home');
			const all = (await store.meta('reviews')) ?? [];
			send(res, 200, all.filter((r) => r.status === 'published' && (!homeSlug || r.home === homeSlug)).map(publicView));
		}],

		// A guest's review. It needs a link an owner made (one use), and waits for an owner to publish it.
		['POST', /^\/api\/reviews$/, async (req, res) => {
			if (!limit(clientIp(req, config.trustProxy))) throw new HttpError(429, 'Too many requests, try again in a minute');
			const b = await readJson(req);
			const link = readReviewToken(b.token, config.sessionSecret);
			if (!link) throw new HttpError(403, 'This review link is not valid');
			await home(link.home);
			const review = { id: randomUUID(), home: link.home, ref: link.ref, tokenId: link.id, ...cleanReview(b), status: 'pending', createdAt: new Date().toISOString() };
			await store.mutate('reviews', (cur = []) => {
				if (cur.some((r) => r.tokenId === link.id)) throw new HttpError(409, 'This review link was already used');
				return [...cur, review];
			});
			send(res, 201, { id: review.id, status: review.status });
		}],

		// A guest booking direct. Rejects dates that overlap an existing stay on any channel.
		['POST', /^\/api\/bookings$/, async (req, res) => {
			if (!limit(clientIp(req, config.trustProxy))) throw new HttpError(429, 'Too many requests, try again in a minute');
			const b = await readJson(req);
			const h = await home(b.home);
			if (!isIsoDate(b.from) || !isIsoDate(b.to) || b.to <= b.from || b.from < today()) throw new HttpError(400, 'Choose valid dates');
			const nights = dayNumber(b.to) - dayNumber(b.from);
			// One request must not be able to block a home for a year: cap the stay and how far ahead it starts.
			if (nights > MAX_NIGHTS) throw new HttpError(400, `Stays are limited to ${MAX_NIGHTS} nights online. Message us for longer.`);
			if (dayNumber(b.from) - dayNumber(today()) > MAX_AHEAD_DAYS) throw new HttpError(400, 'That date is too far ahead to book online');
			const guests = Number(b.guests);
			if (!Number.isInteger(guests) || guests < 1 || guests > h.sleeps) throw new HttpError(400, `Guests must be 1 to ${h.sleeps}`);
			const guest = String(b.name || '').trim().slice(0, 80);
			if (!guest) throw new HttpError(400, 'Name is required');
			await refresh(h.slug, { wait: true }); // just before taking the nights, look at Airbnb and Booking.com once more
			const email = String(b.email || '').trim().slice(0, 120);
			if (!EMAIL.test(email)) throw new HttpError(400, 'A valid email is required');
			if (!isRangeFree(await store.list(), h.slug, b.from, b.to)) throw new HttpError(409, 'Those dates are no longer available', 'OVERLAP');
			let block;
			try {
				// Pending, not confirmed: the nights are held for HOLD_MINUTES while the guest pays or the owner approves.
				const holdUntil = new Date(Date.now() + (config.holdMinutes || 30) * 60_000).toISOString();
				block = await store.add({ home: h.slug, from: b.from, to: b.to, channel: 'direct', status: 'pending', holdUntil, guest, email, guests, total: quote(h.rate, nights).total });
			} catch (err) {
				if (err.code === 'OVERLAP') throw new HttpError(409, 'Those dates are no longer available', 'OVERLAP');
				throw err;
			}
			let checkout = null;
			try {
				const back = config.siteUrl || req.headers.origin || '';
				checkout = await payments.createCheckout({ booking: block, home: h, successUrl: `${back}/book/confirmed/?ref=${block.id}`, cancelUrl: `${back}/book/?home=${h.slug}` });
				if (checkout?.ref) block = await store.update(block.id, { payment: checkout.ref });
			} catch (err) {
				await store.update(block.id, { status: 'cancelled' }); // do not hold nights for a payment page that never opened
				log.error('checkout failed', { booking: block.id, err });
				throw new HttpError(502, 'Payment could not be started, please try again');
			}
			await notify('requested', block);
			send(res, 201, { id: block.id, total: block.total, nights, status: block.status, holdUntil: block.holdUntil, checkoutUrl: checkout?.url || null });
		}],

		// The payment provider calls this when a guest pays. The provider's own code checks the signature.
		['POST', /^\/api\/payments\/webhook\/([a-z0-9-]+)$/, async (req, res, [name]) => {
			if (name !== config.paymentProvider) throw new HttpError(404, 'Unknown payment provider');
			const event = await payments.parseWebhook({ headers: req.headers, raw: await readRaw(req, 200_000) });
			if (!event?.paid) return send(res, 200, { ok: true }); // a failed attempt can be retried; the hold expiring frees the nights
			const block = (await store.list()).find((x) => x.id === event.bookingId);
			// Money was taken but the booking cannot be confirmed: tell the owner, and answer 200 so the provider stops retrying.
			const problem = async (note) => {
				log.error('payment needs attention', { booking: event.bookingId, note });
				if (block?.status === 'pending') await store.update(block.id, { paidConflict: true });
				await notify('paymentIssue', { ...(block || {}), id: event.bookingId, note });
				send(res, 200, { ok: true });
			};
			if (!block || block.status === 'cancelled') return problem('Paid for a booking that is missing or cancelled. Refund or rebook.');
			if (block.status === 'confirmed') return send(res, 200, { ok: true }); // a repeated delivery
			if ((event.ref && block.payment && event.ref !== block.payment) || (event.amount !== undefined && event.amount !== block.total)) return problem('The amount or reference paid does not match the booking.');
			try {
				await notify('confirmed', await store.update(block.id, { status: 'confirmed', holdUntil: undefined, paidConflict: undefined }));
			} catch (err) {
				if (err.code === 'OVERLAP') return problem('Paid after the hold ran out and the dates were taken. Refund or rebook.');
				throw err;
			}
			send(res, 200, { ok: true });
		}],

		// Calendar feed for Airbnb and Booking.com to import, so a direct booking blocks the same nights there.
		// ?for=airbnb leaves out Airbnb's own stays (it already has them); the token keeps the address private.
		['GET', /^\/api\/ical\/([a-z0-9-]+)\.ics$/, async (req, res, [slug], url) => {
			const h = await home(slug);
			if (!config.icalToken || !safeEqual(url.searchParams.get('token') || '', config.icalToken)) throw new HttpError(401, 'Not allowed');
			const target = url.searchParams.get('for');
			const blocks = (await store.list()).filter((x) => x.home === slug && x.channel !== target);
			send(res, 200, buildIcal({ name: `${h.name} availability`, blocks }), { 'content-type': 'text/calendar; charset=utf-8' });
		}],
	];
}

