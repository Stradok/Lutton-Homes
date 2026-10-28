// Pulls each home's Airbnb and Booking.com calendar feeds and stores them as blocks. A failed feed keeps the last good
// blocks (so a short outage never frees up booked nights) and the failure is recorded for the admin page.
import { parseIcal } from './ical.js';
import { resolveConflicts } from './conflicts.js';

const TIMEOUT_MS = 15000;
const MAX_BYTES = 2_000_000;

async function fetchFeed(url, fetchImpl) {
	if (!/^https:\/\//i.test(url)) throw new Error('Feed address must start with https://');
	const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': 'LutonHomesSync/1.0' } });
	if (!res.ok) throw new Error('Feed answered ' + res.status);
	const text = await res.text();
	if (text.length > MAX_BYTES) throw new Error('Feed is too large');
	if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Feed is not an iCalendar file');
	return text;
}

export async function syncAll({ store, homes, fetchImpl = fetch, now = () => new Date().toISOString(), notify }) {
	const results = [];
	for (const home of homes) {
		for (const channel of ['airbnb', 'booking']) {
			const url = home.feeds[channel];
			if (!url) continue;
			const key = `sync:${home.slug}:${channel}`;
			try {
				const blocks = parseIcal(await fetchFeed(url, fetchImpl), { home: home.slug, channel });
				await store.replaceChannel(home.slug, channel, blocks);
				await store.meta(key, { at: now(), ok: true, count: blocks.length });
				results.push({ home: home.slug, channel, ok: true, count: blocks.length });
			} catch (err) {
				await store.meta(key, { at: now(), ok: false, error: String(err.message || err).slice(0, 200) });
				results.push({ home: home.slug, channel, ok: false, error: String(err.message || err).slice(0, 200) });
			}
		}
	}
	await resolveConflicts({ store, notify }); // new Airbnb or Booking.com stays may now clash with ours
	return results;
}

export async function syncStatus({ store, homes }) {
	const out = [];
	for (const home of homes) {
		for (const channel of ['airbnb', 'booking']) {
			out.push({ home: home.slug, channel, configured: Boolean(home.feeds[channel]), last: (await store.meta(`sync:${home.slug}:${channel}`)) || null });
		}
	}
	return out;
}
