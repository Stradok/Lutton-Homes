import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, toCsv } from '../src/reports.js';

let seq = 0;
const block = (over = {}) => ({
	id: `b${++seq}`,
	home: 'alpha',
	from: '2026-06-01',
	to: '2026-06-04',
	channel: 'direct',
	status: 'confirmed',
	total: 300,
	createdAt: '2026-05-01T00:00:00Z',
	...over,
});

test('empty input gives zeros and all four channels', () => {
	const r = buildReport([]);
	assert.deepEqual(r.totals, { bookings: 0, nights: 0 });
	assert.deepEqual(Object.keys(r.channels), ['direct', 'airbnb', 'booking', 'manual']);
	for (const c of Object.values(r.channels)) assert.deepEqual(c, { bookings: 0, nights: 0, revenue: 0, share: 0 });
	assert.deepEqual(r.homes, []);
	assert.deepEqual(r.months, []);
	assert.deepEqual(r.range, { from: null, to: null });
});

test('counts bookings and nights by channel', () => {
	const r = buildReport([
		block({ channel: 'direct', from: '2026-06-01', to: '2026-06-04' }), // 3 nights
		block({ channel: 'airbnb', from: '2026-06-10', to: '2026-06-12' }), // 2 nights
		block({ channel: 'airbnb', from: '2026-06-20', to: '2026-06-21' }), // 1 night
		block({ channel: 'manual', from: '2026-07-01', to: '2026-07-08' }), // 7 nights
	]);
	assert.deepEqual(r.totals, { bookings: 4, nights: 13 });
	assert.deepEqual(r.channels.airbnb, { bookings: 2, nights: 3, revenue: 0, share: 50 });
	assert.deepEqual(r.channels.direct, { bookings: 1, nights: 3, revenue: 300, share: 25 });
	assert.deepEqual(r.channels.booking, { bookings: 0, nights: 0, revenue: 0, share: 0 });
});

test('cancelled blocks are ignored', () => {
	const r = buildReport([
		block({ status: 'cancelled', channel: 'airbnb' }),
		block({ status: 'confirmed', channel: 'airbnb' }),
	]);
	assert.equal(r.totals.bookings, 1);
	assert.equal(r.channels.airbnb.bookings, 1);
});

test('date filter: from inclusive, to exclusive, on check-in date', () => {
	const blocks = [
		block({ from: '2026-05-31', to: '2026-06-02' }), // before from: out
		block({ from: '2026-06-01', to: '2026-06-03' }), // on from: in
		block({ from: '2026-06-29', to: '2026-07-01' }), // last day before to: in
		block({ from: '2026-06-30', to: '2026-07-02' }), // on to: out
	];
	const r = buildReport(blocks, { from: '2026-06-01', to: '2026-06-30' });
	assert.equal(r.totals.bookings, 2);
	assert.deepEqual(r.range, { from: '2026-06-01', to: '2026-06-30' });
});

test('share is rounded to one decimal percent', () => {
	const r = buildReport([
		block({ channel: 'direct' }),
		block({ channel: 'airbnb' }),
		block({ channel: 'airbnb' }),
	]);
	assert.equal(r.channels.direct.share, 33.3);
	assert.equal(r.channels.airbnb.share, 66.7);
	assert.equal(r.channels.manual.share, 0);
});

test('revenue sums only direct totals that are numbers', () => {
	const r = buildReport([
		block({ channel: 'direct', total: 100 }),
		block({ channel: 'direct', total: 50.5 }),
		block({ channel: 'direct', total: undefined }),
		block({ channel: 'airbnb', total: 500 }),
	]);
	assert.equal(r.channels.direct.revenue, 150.5);
	assert.equal(r.channels.airbnb.revenue, 0);
});

test('months are sorted ascending and only cover months with bookings', () => {
	const r = buildReport([
		block({ from: '2026-03-05', to: '2026-03-06', channel: 'airbnb' }),
		block({ from: '2026-01-10', to: '2026-01-11', channel: 'direct' }),
		block({ from: '2026-01-20', to: '2026-01-21', channel: 'booking' }),
		block({ from: '2026-02-01', to: '2026-02-02', status: 'cancelled' }),
	]);
	assert.deepEqual(r.months, [
		{ month: '2026-01', direct: 1, airbnb: 0, booking: 1, manual: 0 },
		{ month: '2026-03', direct: 0, airbnb: 1, booking: 0, manual: 0 },
	]);
});

test('homes include zero-booking homes and slugs seen only in blocks', () => {
	const r = buildReport(
		[block({ home: 'alpha', channel: 'airbnb' }), block({ home: 'gamma', channel: 'manual' })],
		{ homes: [{ slug: 'alpha', name: 'Alpha House' }, { slug: 'beta', name: 'Beta Flat' }] },
	);
	assert.equal(r.homes.length, 3);
	const [alpha, beta, gamma] = r.homes;
	assert.deepEqual(alpha, { slug: 'alpha', name: 'Alpha House', bookings: 1, nights: 3, byChannel: { direct: 0, airbnb: 1, booking: 0, manual: 0 } });
	assert.deepEqual(beta, { slug: 'beta', name: 'Beta Flat', bookings: 0, nights: 0, byChannel: { direct: 0, airbnb: 0, booking: 0, manual: 0 } });
	assert.equal(gamma.name, 'gamma');
	assert.equal(gamma.byChannel.manual, 1);
});

test('toCsv writes channel table, blank line, home table with CRLF endings', () => {
	const r = buildReport([block({ channel: 'direct', total: 120 })], {
		homes: [{ slug: 'alpha', name: 'Alpha' }],
	});
	assert.equal(toCsv(r), [
		'channel,bookings,nights,revenue,share_percent',
		'direct,1,3,120,100',
		'airbnb,0,0,0,0',
		'booking,0,0,0,0',
		'manual,0,0,0,0',
		'',
		'home,bookings,nights',
		'Alpha,1,3',
		'',
	].join('\r\n'));
});

test('toCsv quotes fields with commas and doubles embedded quotes', () => {
	const r = buildReport([block({ home: 'x', channel: 'airbnb' })], {
		homes: [{ slug: 'x', name: 'Smith, "The" House' }],
	});
	const lines = toCsv(r).split('\r\n');
	assert.equal(lines.at(-2), '"Smith, ""The"" House",1,3');
	assert.equal(lines.at(-1), '');
	// Plain values stay unquoted.
	assert.equal(lines[1], 'direct,0,0,0,0');
});
