// On-demand calendar refresh: throttled, shared, bounded, and used right before a booking is taken.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';
import { createRefresher } from '../src/sync.js';

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const basic = (d) => d.replaceAll('-', '');
const feed = (from, to) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:r@airbnb\r\nDTSTART;VALUE=DATE:${basic(from)}\r\nDTEND;VALUE=DATE:${basic(to)}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const homes = [{ slug: 'easystay', name: 'EasyStay', rate: 95, sleeps: 2, feeds: { airbnb: 'https://airbnb.test/c.ics', booking: '' } }];
const tmp = () => { const dir = mkdtempSync(join(tmpdir(), 'lh-refresh-')); return { dir, store: createStore(join(dir, 's.json')) }; };

test('refresh is throttled per home and callers at the same moment share one download', async () => {
	const { dir, store } = tmp();
	let calls = 0, now = 1_000_000;
	const fetchImpl = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return new Response(feed(day(5), day(7))); };
	const refresh = createRefresher({ store, homes, fetchImpl, minGapMs: 60_000, clock: () => now });
	await Promise.all([refresh('easystay', { wait: true }), refresh('easystay', { wait: true }), refresh('easystay', { wait: true })]);
	assert.equal(calls, 1, 'three callers, one download');
	await refresh('easystay', { wait: true });
	assert.equal(calls, 1, 'too soon, skipped');
	now += 61_000;
	await refresh('easystay', { wait: true });
	assert.equal(calls, 2, 'after the gap it downloads again');
	await refresh('unknown', { wait: true });
	assert.equal(calls, 2);
	rmSync(dir, { recursive: true, force: true });
});

test('a slow or failing feed never throws and never holds the guest longer than the wait limit', async () => {
	const { dir, store } = tmp();
	const slow = createRefresher({ store, homes, fetchImpl: () => new Promise(() => {}), waitMs: 50, minGapMs: 0 });
	const t0 = Date.now();
	await slow('easystay', { wait: true });
	assert.ok(Date.now() - t0 < 1000, 'gave up waiting');
	const bad = createRefresher({ store, homes, fetchImpl: async () => { throw new Error('down'); }, minGapMs: 0 });
	await bad('easystay', { wait: true });
	rmSync(dir, { recursive: true, force: true });
});

test('a stay Airbnb published a moment ago stops a booking that the saved copy would have allowed', async () => {
	const { dir, store } = tmp();
	const config = { adminToken: 'a', sessionSecret: '', owners: {}, icalToken: 't', allowedOrigins: [], homes };
	const refresh = createRefresher({ store, homes, fetchImpl: async () => new Response(feed(day(10), day(13))), minGapMs: 0 });
	const server = createServer(createApp({ config, store, notify: async () => {}, refresh }));
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const base = `http://127.0.0.1:${server.address().port}`;
	assert.deepEqual(await store.list(), [], 'nothing saved yet');
	const r = await fetch(`${base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'easystay', from: day(11), to: day(12), guests: 1, name: 'G', email: 'g@t.dev' }) });
	assert.equal(r.status, 409);
	server.close();
	rmSync(dir, { recursive: true, force: true });
});
