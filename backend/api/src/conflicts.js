// Double bookings: two stays from different sources holding the same nights. They can only happen when a guest books on
// Airbnb or Booking.com in the gap before our next calendar check, because our own bookings are checked at once.
import { holds, overlaps } from './availability.js';

const brief = (b) => ({ id: b.id, channel: b.channel, status: b.status, guest: b.guest || '', from: b.from, to: b.to });

export function findConflicts(blocks, now = Date.now()) {
	const today = new Date(now).toISOString().slice(0, 10);
	const live = blocks.filter((b) => holds(b, now) && b.to >= today);
	const out = [];
	for (let i = 0; i < live.length; i++) {
		for (let j = i + 1; j < live.length; j++) {
			const a = live[i], b = live[j];
			// Two stays from one source cannot clash (an owner's block next to a stay in one feed is normal).
			if (a.channel === b.channel || !overlaps(a, b)) continue;
			out.push({ id: [a.id, b.id].sort().join('|'), home: a.home, from: a.from > b.from ? a.from : b.from, to: a.to < b.to ? a.to : b.to, stays: [brief(a), brief(b)] });
		}
	}
	return out;
}

// Run after every calendar check.
//  1. A website request still waiting for payment gives way to a stay that is already confirmed elsewhere: it is cancelled
//     and the guest told, so the owners have nothing to sort out.
//  2. Anything else needs a person (only an owner can cancel an Airbnb or Booking.com stay), so it is listed on the
//     dashboard and the owner is emailed once per clash.
export async function resolveConflicts({ store, notify = async () => {}, now = Date.now() }) {
	const blocks = await store.list();
	for (const c of findConflicts(blocks, now)) {
		const web = c.stays.find((s) => s.channel === 'direct' && s.status === 'pending');
		const other = c.stays.find((s) => s !== web);
		if (!web || other.channel === 'direct' || other.status !== 'confirmed') continue;
		// Only if it is still an unpaid request: a payment may have confirmed or flagged it since the list was read.
		const done = await store.update(web.id, { status: 'cancelled', note: 'Cancelled: the dates were booked elsewhere first' }, (b) => b.status === 'pending' && !b.paidConflict);
		if (done) await notify('cancelled', done);
	}
	const fresh = [];
	await store.mutate('conflicts', (cur = [], all) => {
		const known = new Map(cur.map((c) => [c.id, c]));
		const next = findConflicts(all, now).map((c) => known.get(c.id) ?? { ...c, firstSeen: new Date(now).toISOString() });
		for (const c of next) if (!known.has(c.id)) fresh.push(c);
		return next;
	});
	for (const c of fresh) {
		const names = c.stays.map((s) => `${s.channel} ${s.from} to ${s.to}`).join(' and ');
		await notify('conflict', { id: c.id, home: c.home, note: `Double booking: ${names}. Cancel one of them (only you can cancel an Airbnb or Booking.com stay).` });
	}
}
