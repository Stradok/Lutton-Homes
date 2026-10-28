import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcal, buildIcal } from '../src/ical.js';

// Drop createdAt so tests compare only the fields they care about.
const plain = (blocks) => blocks.map(({ createdAt, ...b }) => b);

const airbnb = [
	'BEGIN:VCALENDAR',
	'VERSION:2.0',
	'PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN',
	'CALSCALE:GREGORIAN',
	'X-WR-CALNAME:Bell Street',
	'BEGIN:VEVENT',
	'DTSTAMP:20261028T100000Z',
	'UID:1234567890-airbnb@airbnb.com',
	'DTSTART;VALUE=DATE:20261115',
	'DTEND;VALUE=DATE:20261118',
	'SUMMARY:Reserved',
	'DESCRIPTION:Reservation URL: https://www.airbnb.co.uk/hosting/reservations/details/HMX\\nPhone Last 4 Digits: 1234',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'UID:0987654321-airbnb@airbnb.com',
	'DTSTART;VALUE=DATE:20261201',
	'DTEND;VALUE=DATE:20261204',
	'SUMMARY:Airbnb (Not available)',
	'END:VEVENT',
	'END:VCALENDAR',
].join('\r\n') + '\r\n';

test('parses an Airbnb feed with CRLF line endings', () => {
	const blocks = parseIcal(airbnb, { home: 'bell-street', channel: 'airbnb' });
	assert.deepEqual(plain(blocks), [
		{ id: '1234567890-airbnb@airbnb.com', home: 'bell-street', from: '2026-11-15', to: '2026-11-18', channel: 'airbnb', status: 'confirmed', guest: 'Reserved' },
		{ id: '0987654321-airbnb@airbnb.com', home: 'bell-street', from: '2026-12-01', to: '2026-12-04', channel: 'airbnb', status: 'confirmed', guest: 'Airbnb (Not available)' },
	]);
	assert.ok(!Number.isNaN(Date.parse(blocks[0].createdAt)));
});

test('parses Booking.com DATE-TIME and TZID values, keeping only the date', () => {
	const feed = [
		'BEGIN:VCALENDAR',
		'PRODID:-//Booking.com//iCal//EN',
		'BEGIN:VEVENT',
		'DTSTART;TZID=Europe/London:20261201T150000',
		'DTEND;TZID=Europe/London:20261204T110000',
		'UID:4455667788@booking.com',
		'STATUS:CONFIRMED',
		'SUMMARY:John Smith',
		'END:VEVENT',
		'BEGIN:VEVENT',
		'DTSTART:20261210T140000Z',
		'DTEND:20261212T100000Z',
		'UID:4455667789@booking.com',
		'END:VEVENT',
		'END:VCALENDAR',
	].join('\n');
	assert.deepEqual(plain(parseIcal(feed, { home: 'bell-street', channel: 'booking' })), [
		{ id: '4455667788@booking.com', home: 'bell-street', from: '2026-12-01', to: '2026-12-04', channel: 'booking', status: 'confirmed', guest: 'John Smith' },
		{ id: '4455667789@booking.com', home: 'bell-street', from: '2026-12-10', to: '2026-12-12', channel: 'booking', status: 'confirmed' },
	]);
});

test('unfolds continued lines that start with a space or a tab', () => {
	const feed = [
		'BEGIN:VEVENT',
		'DTSTART;VALUE=DATE:20261115',
		'DTEND;VALUE=DATE:20261118',
		'UID:fold-1',
		'SUMMARY:Jane Sm',
		' ith-',
		'\tJones',
		'END:VEVENT',
	].join('\r\n');
	assert.deepEqual(plain(parseIcal(feed, { home: 'h', channel: 'airbnb' })), [
		{ id: 'fold-1', home: 'h', from: '2026-11-15', to: '2026-11-18', channel: 'airbnb', status: 'confirmed', guest: 'Jane Smith-Jones' },
	]);
});

test('skips CANCELLED events and keeps the rest', () => {
	const feed = [
		'BEGIN:VEVENT',
		'DTSTART;VALUE=DATE:20261115',
		'DTEND;VALUE=DATE:20261118',
		'UID:gone',
		'STATUS:CANCELLED',
		'END:VEVENT',
		'BEGIN:VEVENT',
		'DTSTART;VALUE=DATE:20261120',
		'DTEND;VALUE=DATE:20261121',
		'UID:kept',
		'STATUS:CONFIRMED',
		'END:VEVENT',
	].join('\n');
	assert.deepEqual(plain(parseIcal(feed, { home: 'h', channel: 'airbnb' })).map((b) => b.id), ['kept']);
});

test('uses DTSTART plus one day when DTEND is missing, across a month boundary', () => {
	const feed = 'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261231\nUID:no-end\nEND:VEVENT';
	assert.deepEqual(plain(parseIcal(feed, { home: 'h', channel: 'manual' })), [
		{ id: 'no-end', home: 'h', from: '2026-12-31', to: '2027-01-01', channel: 'manual', status: 'confirmed' },
	]);
});

test('skips events with missing or invalid DTSTART and events where to <= from', () => {
	const feed = [
		'BEGIN:VEVENT', 'DTEND;VALUE=DATE:20261118', 'UID:no-start', 'END:VEVENT',
		'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261340', 'DTEND;VALUE=DATE:20261345', 'UID:bad-month', 'END:VEVENT',
		'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261115', 'DTEND;VALUE=DATE:20261115', 'UID:same-day', 'END:VEVENT',
		'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261115', 'DTEND;VALUE=DATE:20261110', 'UID:backwards', 'END:VEVENT',
		'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20261203', 'UID:ok', 'END:VEVENT',
	].join('\n');
	assert.deepEqual(plain(parseIcal(feed, { home: 'h', channel: 'airbnb' })).map((b) => b.id), ['ok']);
});

test('unescapes iCal text in SUMMARY and generates an id when UID is absent', () => {
	const feed = String.raw`BEGIN:VEVENT
DTSTART;VALUE=DATE:20261115
DTEND;VALUE=DATE:20261118
SUMMARY:Smith\, J\; family\\ x\nfriends
END:VEVENT`;
	assert.deepEqual(plain(parseIcal(feed, { home: 'bell', channel: 'booking' })), [
		{
			id: 'booking-bell-2026-11-15-2026-11-18',
			home: 'bell',
			from: '2026-11-15',
			to: '2026-11-18',
			channel: 'booking',
			status: 'confirmed',
			guest: 'Smith, J; family\\ x\nfriends',
		},
	]);
});

test('returns [] for garbage input', () => {
	const garbage = [
		'hello world',
		'',
		'BEGIN:VEVENT\nDTSTART:notadate\nEND:VEVENT',
		'BEGIN:VEVENT\nEND:VEVENT',
		'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261115',
		'\u0000\u0001ÿ\n\r\n:::;;;',
		null,
		undefined,
		42,
		{},
	];
	for (const input of garbage) assert.deepEqual(parseIcal(input, { home: 'h', channel: 'airbnb' }), []);
});

test('build then parse keeps from and to, and parse ignores guest names it never wrote', () => {
	const blocks = [{ id: 'rt-1', home: 'bell', from: '2026-12-01', to: '2026-12-04', channel: 'direct', status: 'confirmed', guest: 'Secret Guest', createdAt: new Date().toISOString() }];
	const out = buildIcal({ name: 'Bell Street', blocks });
	const parsed = parseIcal(out, { home: 'bell', channel: 'direct' });
	assert.equal(parsed.length, 1);
	assert.equal(parsed[0].from, '2026-12-01');
	assert.equal(parsed[0].to, '2026-12-04');
	assert.ok(!out.includes('Secret Guest'));
});

test('buildIcal leaves out cancelled blocks and never writes guest names', () => {
	const blocks = [
		{ id: 'c1', home: 'bell', from: '2026-11-15', to: '2026-11-18', channel: 'direct', status: 'confirmed', guest: 'Jane Secret', createdAt: '' },
		{ id: 'c2', home: 'bell', from: '2026-11-20', to: '2026-11-22', channel: 'direct', status: 'cancelled', guest: 'Other Person', createdAt: '' },
	];
	const out = buildIcal({ name: 'Bell, Lodge', blocks });
	assert.equal(out.split('BEGIN:VEVENT').length - 1, 1);
	assert.ok(!out.includes('Jane Secret'));
	assert.ok(!out.includes('Other Person'));
	assert.ok(!out.includes('c2@lutonhomes'));
	assert.ok(out.includes('UID:c1@lutonhomes\r\n'));
	assert.ok(out.includes('DTSTART;VALUE=DATE:20261115\r\n'));
	assert.ok(out.includes('DTEND;VALUE=DATE:20261118\r\n'));
	assert.ok(out.includes('SUMMARY:Reserved\r\n'));
	assert.ok(out.includes('PRODID:-//Luton Homes//Availability//EN\r\n'));
	assert.ok(out.includes('X-WR-CALNAME:Bell\\, Lodge\r\n'));
});

test('buildIcal folds lines over 75 octets without splitting UTF-8 characters', () => {
	const blocks = [
		{ id: 'x'.repeat(90), home: 'bell', from: '2026-11-15', to: '2026-11-18', channel: 'direct', status: 'confirmed' },
		{ id: 'é'.repeat(60), home: 'bell', from: '2026-12-01', to: '2026-12-02', channel: 'direct', status: 'confirmed' },
	];
	const out = buildIcal({ name: 'Bell Street', blocks });
	assert.ok(out.endsWith('\r\n'));
	assert.ok(!/[^\r]\n/.test(out), 'every newline must be CRLF');
	for (const line of out.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line}`);
	assert.ok(!out.includes('�'));
	const parsed = parseIcal(out, { home: 'bell', channel: 'direct' });
	assert.deepEqual(parsed.map((b) => b.id), ['x'.repeat(90) + '@lutonhomes', 'é'.repeat(60) + '@lutonhomes']);
});
