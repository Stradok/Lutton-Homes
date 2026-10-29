// Pulls each home's Airbnb and Booking.com calendar feeds and stores them as blocks. A failed feed keeps the last good
// blocks (so a short outage never frees up booked nights) and the failure is recorded for the admin page.
import { parseIcal } from './ical.js';
import { log } from './log.js';
import { resolveConflicts } from './conflicts.js';

const TIMEOUT_MS = 15000;
const MAX_BYTES = 2_000_000;

async function fetchFeed(url, fetchImpl, timeoutMs) {
	if (!/^https:\/\//i.test(url)) throw new Error('Feed address must start with https://');
	const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'LutonHomesSync/1.0' } });
	if (!res.ok) throw new Error('Feed answered ' + res.status);
	const text = await res.text();
	if (text.length > MAX_BYTES) throw new Error('Feed is too large');
	if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Feed is not an iCalendar file');
	return text;
}

// One home's feeds. Every caller (timer, owner button, a guest about to book) goes through here.
export async function syncHome({ store, home, fetchImpl = fetch, now = () => new Date().toISOString(), timeoutMs = TIMEOUT_MS }) {
	const results = [];
	for (const channel of ['airbnb', 'booking']) {
		const url = home.feeds[channel];
		if (!url) continue;
		const key = `sync:${home.slug}:${channel}`;
		try {
			const blocks = parseIcal(await fetchFeed(url, fetchImpl, timeoutMs), { home: home.slug, channel });
			await store.replaceChannel(home.slug, channel, blocks);
			await store.meta(key, { at: now(), ok: true, count: blocks.length });
			results.push({ home: home.slug, channel, ok: true, count: blocks.length });
		} catch (err) {
			await store.meta(key, { at: now(), ok: false, error: String(err.message || err).slice(0, 200) });
			results.push({ home: home.slug, channel, ok: false, error: String(err.message || err).slice(0, 200) });
		}
	}
	return results;
}

export async function syncAll({ store, homes, fetchImpl = fetch, now, notify }) {
	const results = [];
	for (const home of homes) results.push(...(await syncHome({ store, home, fetchImpl, now })));
	// New Airbnb or Booking.com stays may now clash with ours. A failure here must not hide the sync results.
	try { await resolveConflicts({ store, notify }); } catch (err) { log.error('conflict check failed', { err }); }
	return results;
}

// On-demand refresh for one home, used when a guest looks at the calendar or is about to book. It is throttled (at most one
// download per home every minGapMs, and callers at the same moment share one), so visitors cannot hammer Airbnb or Booking.com,
// and it never throws. Airbnb and Booking.com publish their calendars on their own schedule, so this narrows the gap but does
// not close it.
export function createRefresher({ store, homes, notify, fetchImpl = fetch, minGapMs = 120_000, waitMs = 5_000, clock = Date.now }) {
	const last = new Map(), inflight = new Map();
	return function refresh(slug, { wait = false } = {}) {
		const home = homes.find((h) => h.slug === slug);
		if (!home || !(home.feeds.airbnb || home.feeds.booking)) return Promise.resolve();
		let run = inflight.get(slug);
		if (!run && clock() - (last.get(slug) ?? 0) >= minGapMs) {
			last.set(slug, clock());
			run = syncHome({ store, home, fetchImpl, timeoutMs: waitMs })
				.then(() => resolveConflicts({ store, notify }))
				.catch((err) => log.error('refresh failed', { home: slug, err }))
				.finally(() => inflight.delete(slug));
			inflight.set(slug, run);
		}
		// A guest about to book waits for the download, but never longer than waitMs.
		if (!(wait && run)) return Promise.resolve();
		let timer;
		return Promise.race([run, new Promise((r) => { timer = setTimeout(r, waitMs); })]).finally(() => clearTimeout(timer));
	};
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
