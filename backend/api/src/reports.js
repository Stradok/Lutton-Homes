// Pure report builder over blocks. No I/O: the caller loads blocks and homes.
import { CHANNELS, dayNumber } from './shapes.js';

const emptyCounts = () => Object.fromEntries(CHANNELS.map((c) => [c, 0]));

// Percent of a whole, one decimal. Zero when there is nothing to divide by.
const percent = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

// Money sums pick up float noise (0.1 + 0.2); round back to pence.
const pence = (n) => Math.round(n * 100) / 100;

// Blocks with an unknown channel are skipped, so the channel keys always match CHANNELS.
// Dates are ISO strings, so string comparison orders them correctly.
// Airbnb and Booking.com export owner-set blocks ("Airbnb (Not available)", "CLOSED - Not available") in the same feed as stays.
// They still block nights on the calendar but are not guests, so reports leave them out.
const ownerBlock = (b) => b.channel !== 'direct' && /not available|closed|blocked/i.test(b.guest || '');

export function buildReport(blocks, { from = null, to = null, homes = [] } = {}) {
	const kept = blocks.filter((b) => b.status === 'confirmed'
		&& !ownerBlock(b)
		&& CHANNELS.includes(b.channel)
		&& (!from || b.from >= from)
		&& (!to || b.from < to));

	const channels = Object.fromEntries(CHANNELS.map((c) => [c, { bookings: 0, nights: 0, revenue: 0, share: 0 }]));
	const homeMap = new Map(homes.map((h) => [h.slug, { slug: h.slug, name: h.name, bookings: 0, nights: 0, byChannel: emptyCounts() }]));
	const monthMap = new Map();

	for (const b of kept) {
		const nights = dayNumber(b.to) - dayNumber(b.from);
		const ch = channels[b.channel];
		ch.bookings += 1;
		ch.nights += nights;
		// Only direct bookings carry a price.
		if (b.channel === 'direct' && typeof b.total === 'number') ch.revenue += b.total;

		// A slug missing from `homes` still gets a row; its name falls back to the slug.
		if (!homeMap.has(b.home)) homeMap.set(b.home, { slug: b.home, name: b.home, bookings: 0, nights: 0, byChannel: emptyCounts() });
		const h = homeMap.get(b.home);
		h.bookings += 1;
		h.nights += nights;
		h.byChannel[b.channel] += 1;

		const month = b.from.slice(0, 7);
		if (!monthMap.has(month)) monthMap.set(month, { month, ...emptyCounts() });
		monthMap.get(month)[b.channel] += 1;
	}

	const totalBookings = CHANNELS.reduce((sum, c) => sum + channels[c].bookings, 0);
	const totalNights = CHANNELS.reduce((sum, c) => sum + channels[c].nights, 0);
	for (const c of CHANNELS) {
		channels[c].share = percent(channels[c].bookings, totalBookings);
		channels[c].revenue = pence(channels[c].revenue);
	}

	return {
		range: { from, to },
		totals: { bookings: totalBookings, nights: totalNights },
		channels,
		homes: [...homeMap.values()],
		months: [...monthMap.values()].sort((a, b) => (a.month < b.month ? -1 : 1)),
	};
}

// Quote a field only when it holds a comma, quote or line break; double any embedded quotes.
const cell = (v) => {
	const s = String(v);
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(report) {
	const rows = [['channel', 'bookings', 'nights', 'revenue', 'share_percent']];
	for (const c of CHANNELS) {
		const { bookings, nights, revenue, share } = report.channels[c];
		rows.push([c, bookings, nights, revenue, share]);
	}
	// Blank line separates the channel table from the home table.
	rows.push([]);
	rows.push(['home', 'bookings', 'nights']);
	for (const h of report.homes) rows.push([h.name, h.bookings, h.nights]);
	return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
