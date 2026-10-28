// End-to-end: the real request handler on a real port, a temp store, and a fake fetch standing in for Airbnb and Booking.com.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';
import { syncAll } from '../src/sync.js';

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const basic = (d) => d.replaceAll('-', '');
const feed = (from, to) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:abc@airbnb\r\nDTSTART;VALUE=DATE:${basic(from)}\r\nDTEND;VALUE=DATE:${basic(to)}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

async function boot() {
	const dir = mkdtempSync(join(tmpdir(), 'lh-api-'));
	const config = {
		adminToken: 'secret-admin', icalToken: 'secret-ical', allowedOrigins: ['https://site.test'],
		homes: [{ slug: 'easystay', name: 'EasyStay', rate: 95, sleeps: 2, feeds: { airbnb: 'https://airbnb.test/cal.ics', booking: '' } }],
	};
	const store = createStore(join(dir, 'store.json'));
	const server = createServer(createApp({ config, store }));
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const base = `http://127.0.0.1:${server.address().port}`;
	return { base, store, config, close: () => { server.close(); rmSync(dir, { recursive: true, force: true }); } };
}
const admin = { authorization: 'Bearer secret-admin' };

test('an Airbnb booking found by the sync blocks those nights on the public calendar', async () => {
	const t = await boot();
	const results = await syncAll({ store: t.store, homes: t.config.homes, fetchImpl: async () => new Response(feed(day(10), day(13))) });
	assert.deepEqual(results.map((r) => [r.channel, r.ok, r.count]), [['airbnb', true, 1]]);
	const a = await (await fetch(`${t.base}/api/availability/easystay?days=30`)).json();
	assert.equal(a.days[day(10)], 'booked');
	assert.equal(a.days[day(12)], 'booked');
	assert.equal(a.days[day(13)], 'free', 'check-out day is free again');
	assert.equal(JSON.stringify(a).includes('airbnb'), false, 'the public answer never names the channel');
	t.close();
});

test('a failed feed keeps the last good blocks and records the failure', async () => {
	const t = await boot();
	await syncAll({ store: t.store, homes: t.config.homes, fetchImpl: async () => new Response(feed(day(5), day(7))) });
	const bad = await syncAll({ store: t.store, homes: t.config.homes, fetchImpl: async () => new Response('nope', { status: 503 }) });
	assert.equal(bad[0].ok, false);
	assert.equal((await t.store.list()).length, 1);
	const status = await (await fetch(`${t.base}/api/admin/sync-status`, { headers: admin })).json();
	assert.equal(status[0].last.ok, false);
	t.close();
});

test('a direct booking is stored, priced and then blocks the dates for the next guest', async () => {
	const t = await boot();
	const body = JSON.stringify({ home: 'easystay', from: day(20), to: day(22), guests: 2, name: 'Guest A' });
	const ok = await fetch(`${t.base}/api/bookings`, { method: 'POST', body });
	assert.equal(ok.status, 201);
	assert.equal((await ok.json()).total, 95 * 2 + 35);
	const again = await fetch(`${t.base}/api/bookings`, { method: 'POST', body });
	assert.equal(again.status, 409);
	t.close();
});

test('direct booking rejects bad input', async () => {
	const t = await boot();
	for (const b of [{ home: 'nope' }, { home: 'easystay', from: day(5), to: day(4), guests: 1, name: 'x' }, { home: 'easystay', from: day(5), to: day(6), guests: 9, name: 'x' }, { home: 'easystay', from: day(5), to: day(6), guests: 1, name: ' ' }, { home: 'easystay', from: '2026-13-40', to: '2026-13-41', guests: 1, name: 'x' }]) {
		const r = await fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify(b) });
		assert.ok([400, 404].includes(r.status), JSON.stringify(b) + ' -> ' + r.status);
	}
	t.close();
});

test('the report counts bookings by where they came from, and needs the admin token', async () => {
	const t = await boot();
	await syncAll({ store: t.store, homes: t.config.homes, fetchImpl: async () => new Response(feed(day(10), day(13))) });
	await fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'easystay', from: day(20), to: day(22), guests: 1, name: 'G' }) });
	assert.equal((await fetch(`${t.base}/api/admin/report`)).status, 401);
	assert.equal((await fetch(`${t.base}/api/admin/report`, { headers: { authorization: 'Bearer wrong' } })).status, 401);
	const r = await (await fetch(`${t.base}/api/admin/report`, { headers: admin })).json();
	assert.equal(r.channels.direct.bookings, 1);
	assert.equal(r.channels.airbnb.bookings, 1);
	assert.equal(r.totals.bookings, 2);
	const csv = await fetch(`${t.base}/api/admin/report?format=csv`, { headers: admin });
	assert.match(await csv.text(), /^channel,bookings,nights,revenue,share_percent/);
	t.close();
});

test('the calendar feed for Airbnb and Booking.com needs its token and leaves out the importer\'s own stays', async () => {
	const t = await boot();
	await syncAll({ store: t.store, homes: t.config.homes, fetchImpl: async () => new Response(feed(day(10), day(13))) });
	await fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'easystay', from: day(20), to: day(22), guests: 1, name: 'Secret Name' }) });
	assert.equal((await fetch(`${t.base}/api/ical/easystay.ics`)).status, 401);
	const text = await (await fetch(`${t.base}/api/ical/easystay.ics?token=secret-ical&for=airbnb`)).text();
	assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 1, 'only the direct stay is exported to Airbnb');
	assert.equal(text.includes('Secret Name'), false, 'guest names never leave');
	t.close();
});

test('cancelling a booking frees its nights; admin routes reject guests; CORS only for the listed site', async () => {
	const t = await boot();
	const created = await (await fetch(`${t.base}/api/admin/bookings`, { method: 'POST', headers: admin, body: JSON.stringify({ home: 'easystay', from: day(30), to: day(32), guest: 'Phone call' }) })).json();
	let a = await (await fetch(`${t.base}/api/availability/easystay?days=40`)).json();
	assert.equal(a.days[day(30)], 'booked');
	assert.equal((await fetch(`${t.base}/api/admin/bookings/${created.id}/cancel`, { method: 'POST' })).status, 401);
	await fetch(`${t.base}/api/admin/bookings/${created.id}/cancel`, { method: 'POST', headers: admin });
	a = await (await fetch(`${t.base}/api/availability/easystay?days=40`)).json();
	assert.equal(a.days[day(30)], 'free');
	const ok = await fetch(`${t.base}/api/health`, { headers: { origin: 'https://site.test' } });
	assert.equal(ok.headers.get('access-control-allow-origin'), 'https://site.test');
	const no = await fetch(`${t.base}/api/health`, { headers: { origin: 'https://evil.test' } });
	assert.equal(no.headers.get('access-control-allow-origin'), null);
	t.close();
});

test('hardening: long stays, far-future dates and non-object bodies are refused; owner blocks stay out of the report', async () => {
	const t = await boot();
	const post = (b) => fetch(`${t.base}/api/bookings`, { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b) });
	assert.equal((await post({ home: 'easystay', from: day(5), to: day(60), guests: 1, name: 'x' })).status, 400);
	assert.equal((await post({ home: 'easystay', from: day(500), to: day(502), guests: 1, name: 'x' })).status, 400);
	assert.equal((await post('null')).status, 400);
	const block = (s) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x@b\r\nDTSTART;VALUE=DATE:${basic(day(40))}\r\nDTEND;VALUE=DATE:${basic(day(42))}\r\nSUMMARY:${s}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
	await syncAll({ store: t.store, homes: t.config.homes, fetchImpl: async () => new Response(block('Airbnb (Not available)')) });
	const a = await (await fetch(`${t.base}/api/availability/easystay?days=60`)).json();
	assert.equal(a.days[day(40)], 'booked', 'an owner block still blocks the nights');
	const r = await (await fetch(`${t.base}/api/admin/report`, { headers: admin })).json();
	assert.equal(r.channels.airbnb.bookings, 0, 'but it is not counted as a guest');
	t.close();
});

test('a fresh install creates its data folder', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'lh-fresh-'));
	const store = createStore(join(dir, 'does', 'not', 'exist', 'store.json'));
	assert.deepEqual(await store.list(), []);
	await store.add({ home: 'easystay', from: day(1), to: day(2), channel: 'direct', status: 'confirmed' });
	assert.equal((await store.list()).length, 1);
	rmSync(dir, { recursive: true, force: true });
});
