// Demo only: live availability for the static demo, which has no API server. It reads one home's Lodgify calendar link
// (the setting FEED_LODGIFY_<HOME>, same names as the real API) and answers { home, from, days: { date: 'booked' | 'free' } },
// the same shape as the real API's GET /api/availability/<home>. It stores nothing and never returns names or the link.
const DAY = 864e5;
const dayOf = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / DAY);
const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const icalDay = (v) => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(v || ''); return m && !Number.isNaN(dayOf(`${m[1]}-${m[2]}-${m[3]}`)) ? dayOf(`${m[1]}-${m[2]}-${m[3]}`) : null; };

// Night numbers held by the events of an iCalendar text. DTEND is the check-out day, so that night is not held.
export function bookedNights(ics) {
	const nights = new Set();
	let ev = null;
	for (const line of String(ics).replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
		const m = /^([A-Za-z-]+)(?:;[^:]*)?:(.*)$/.exec(line);
		if (!m) continue;
		const key = m[1].toUpperCase(), val = m[2].trim();
		if (key === 'BEGIN' && val === 'VEVENT') ev = {};
		else if (key === 'END' && val === 'VEVENT') {
			const a = ev && icalDay(ev.start), b = ev && (ev.end ? icalDay(ev.end) : a === null ? null : a + 1);
			if (a !== null && b !== null && ev.status !== 'CANCELLED' && b > a) for (let n = a; n < b && n - a < 400; n++) nights.add(n);
			ev = null;
		} else if (ev) {
			if (key === 'DTSTART') ev.start = val; else if (key === 'DTEND') ev.end = val; else if (key === 'STATUS') ev.status = val.toUpperCase();
		}
	}
	return nights;
}

export default async function handler(req, res, { env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
	const slug = String(req.query?.slug || '');
	const link = /^[a-z0-9-]+$/.test(slug) ? env['FEED_LODGIFY_' + slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')] : '';
	if (!link || !/^https:\/\//.test(link)) return res.status(404).json({ error: 'Not found' });
	try {
		const r = await fetchImpl(link, { signal: AbortSignal.timeout(10_000) });
		const text = r.ok ? await r.text() : '';
		if (!text.includes('BEGIN:VCALENDAR') || text.length > 2_000_000) throw new Error('bad feed');
		const nights = bookedNights(text);
		const days = Math.min(Math.max(parseInt(req.query?.days, 10) || 120, 1), 400);
		const start = Math.floor(now() / DAY);
		const out = {};
		for (let i = 0; i < days; i++) out[isoOf(start + i)] = nights.has(start + i) ? 'booked' : 'free';
		res.setHeader('cache-control', 'public, s-maxage=120, stale-while-revalidate=600'); // Lodgify is asked at most about every 2 minutes
		return res.status(200).json({ home: slug, from: isoOf(start), days: out });
	} catch {
		return res.status(502).json({ error: 'Calendar unavailable' }); // never echo the link or the reason
	}
}
