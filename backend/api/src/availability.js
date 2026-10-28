// Pure availability maths over blocks. No I/O, so the store and the server can both call it.
import { CHANNELS, dayNumber, isoFromDay, isIsoDate } from './shapes.js';

// Unknown channels sort last so they never beat a known one.
const rankOf = (channel) => {
	const i = CHANNELS.indexOf(channel);
	return i < 0 ? CHANNELS.length : i;
};

// Night numbers covered by a block: `from` inclusive, `to` exclusive.
export function blockNights(block) {
	const nights = [];
	for (let d = dayNumber(block.from); d < dayNumber(block.to); d++) nights.push(d);
	return nights;
}

// Confirmed stays hold their nights; a pending one holds them only until its hold runs out.
export const holds = (b, now = Date.now()) => b.status === 'confirmed' || (b.status === 'pending' && Date.parse(b.holdUntil) > now);

export function activeBlocks(blocks, home, now = Date.now()) {
	return blocks.filter((b) => b.home === home && holds(b, now));
}

// Same-day turnover (a.to === b.from) is not an overlap: the night belongs to the next guest.
export function overlaps(a, b) {
	return a.home === b.home && a.from < b.to && b.from < a.to;
}

export function isRangeFree(blocks, home, from, to) {
	if (!isIsoDate(from) || !isIsoDate(to) || to <= from) return false;
	const probe = { home, from, to };
	return !activeBlocks(blocks, home).some((b) => overlaps(b, probe));
}

// Returns { days: {date: 'free'|'booked'}, channels: {date: channel} } where channels only lists booked nights.
// Overlapping blocks (possible for external calendars) resolve to the channel earliest in CHANNELS.
export function availabilityMap(blocks, home, fromIso, days) {
	if (!isIsoDate(fromIso)) throw new TypeError(`fromIso is not an ISO date: ${fromIso}`);
	const winner = new Map(); // night number -> { rank, channel }
	for (const b of activeBlocks(blocks, home)) {
		const rank = rankOf(b.channel);
		for (const n of blockNights(b)) {
			const cur = winner.get(n);
			if (!cur || rank < cur.rank) winner.set(n, { rank, channel: b.channel });
		}
	}
	const start = dayNumber(fromIso);
	const out = { days: {}, channels: {} };
	for (let i = 0; i < days; i++) {
		const date = isoFromDay(start + i);
		const hit = winner.get(start + i);
		out.days[date] = hit ? 'booked' : 'free';
		if (hit) out.channels[date] = hit.channel;
	}
	return out;
}

export function bookedRanges(blocks, home) {
	return activeBlocks(blocks, home)
		.map(({ from, to, channel }) => ({ from, to, channel }))
		.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}
