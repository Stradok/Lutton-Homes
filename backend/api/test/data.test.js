// Property, photo and review endpoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';
import { hashPassword } from '../src/auth.js';

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
async function boot(extra = {}) {
	const dir = mkdtempSync(join(tmpdir(), 'lh-data-'));
	const seed = [{ slug: 'easystay', name: 'EasyStay', rate: 95, sleeps: 2, images: [], tour: [] }];
	const config = { adminToken: '', sessionSecret: 's3cret', owners: { admin: hashPassword('pw') }, paymentProvider: 'manual', icalToken: 't', allowedOrigins: [], homes: seed, seedHomes: seed, uploadsDir: join(dir, 'up'), apiUrl: 'https://api.test', deployHook: '', ...extra };
	const store = createStore(join(dir, 'store.json'));
	const server = createServer(createApp({ config, store, notify: async () => {} }));
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const base = `http://127.0.0.1:${server.address().port}`;
	const token = (await (await fetch(`${base}/api/admin/login`, { method: 'POST', body: JSON.stringify({ user: 'admin', password: 'pw' }) })).json()).token;
	const auth = { authorization: 'Bearer ' + token };
	return { base, auth, store, config, close: () => { server.close(); rmSync(dir, { recursive: true, force: true }); } };
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('properties: seeded list, owner adds, edits and removes; guests can book the new one', async () => {
	const t = await boot();
	assert.deepEqual((await (await fetch(`${t.base}/api/homes`)).json()).map((h) => h.slug), ['easystay']);
	const add = (b) => fetch(`${t.base}/api/admin/homes`, { method: 'POST', headers: t.auth, body: JSON.stringify(b) });
	assert.equal((await fetch(`${t.base}/api/admin/homes`, { method: 'POST', body: '{}' })).status, 401);
	assert.equal((await add({ name: '', rate: 50, sleeps: 2 })).status, 400);
	assert.equal((await add({ name: 'X', rate: -1, sleeps: 2 })).status, 400);
	const made = await (await add({ name: 'Cafe Nest', category: 'restaurants', rate: 40, sleeps: 4, amenities: ['Wi-Fi'], rooms: [{ type: 'Kitchen', photos: [{ day: 'https://api.test/api/media/a.jpg', night: 'javascript:alert(1)' }, { day: 'data:text/html,x' }] }] })).json();
	assert.equal(made.slug, 'cafe-nest');
	assert.deepEqual(made.images, ['https://api.test/api/media/a.jpg'], 'only real addresses are kept');
	assert.equal(made.tour[0].title, 'Kitchen');
	assert.equal((await add({ name: 'Cafe Nest', rate: 40, sleeps: 4 })).status, 409);
	assert.equal((await fetch(`${t.base}/api/homes`)).headers.get('content-type').includes('json'), true);
	assert.equal((await (await fetch(`${t.base}/api/homes`)).json()).length, 2);
	const bk = await fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'cafe-nest', from: day(5), to: day(7), guests: 2, name: 'G', email: 'g@t.dev' }) });
	assert.equal(bk.status, 201);
	const del = await fetch(`${t.base}/api/admin/homes/cafe-nest`, { method: 'DELETE', headers: t.auth });
	assert.equal(del.status, 409, 'cannot remove a property that has a current booking');
	const put = await (await fetch(`${t.base}/api/admin/homes/easystay`, { method: 'PUT', headers: t.auth, body: JSON.stringify({ rate: 120 }) })).json();
	assert.equal(put.rate, 120);
	assert.equal(put.slug, 'easystay');
	assert.equal((await fetch(`${t.base}/api/admin/homes/nope`, { method: 'PUT', headers: t.auth, body: '{"rate":1}' })).status, 404);
	assert.equal((await fetch(`${t.base}/api/admin/homes/easystay`, { method: 'DELETE', headers: t.auth })).status, 200);
	assert.equal((await fetch(`${t.base}/api/homes/easystay`)).status, 404);
	t.close();
});

test('photo upload accepts real images only and serves them back safely', async () => {
	const t = await boot();
	const up = (body) => fetch(`${t.base}/api/admin/uploads`, { method: 'POST', headers: t.auth, body });
	assert.equal((await fetch(`${t.base}/api/admin/uploads`, { method: 'POST', body: PNG })).status, 401);
	assert.equal((await up('<script>alert(1)</script>')).status, 415);
	const { url } = await (await up(PNG)).json();
	assert.match(url, /^https:\/\/api\.test\/api\/media\/[a-f0-9]{24}\.png$/);
	const got = await fetch(url.replace('https://api.test', t.base));
	assert.equal(got.headers.get('content-type'), 'image/png');
	assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
	assert.equal((await fetch(`${t.base}/api/media/..%2Fstore.json`)).status, 404);
	assert.equal((await fetch(`${t.base}/api/media/${'a'.repeat(24)}.png`)).status, 404);
	assert.equal((await up(Buffer.alloc(6_100_000, 1))).status, 413);
	t.close();
});

test('reviews: only with an owner-made one-use link, held until published, then public', async () => {
	const t = await boot();
	const post = (b) => fetch(`${t.base}/api/reviews`, { method: 'POST', body: JSON.stringify(b) });
	assert.equal((await post({ token: 'x', stars: 5, text: 'Lovely' })).status, 403);
	assert.equal((await fetch(`${t.base}/api/admin/review-links`, { method: 'POST', body: '{}' })).status, 401);
	assert.equal((await fetch(`${t.base}/api/admin/review-links`, { method: 'POST', headers: t.auth, body: '{"home":"nope"}' })).status, 400);
	const { token } = await (await fetch(`${t.base}/api/admin/review-links`, { method: 'POST', headers: t.auth, body: JSON.stringify({ home: 'easystay', ref: 'LH-1' }) })).json();
	assert.equal((await post({ token, stars: 4, text: 'x' })).status, 400, 'only 1, 3 or 5 stars');
	assert.equal((await post({ token, stars: 5, text: ' ' })).status, 400);
	const r = await post({ token, stars: 5, text: 'Lovely stay', name: 'Sam' });
	assert.equal(r.status, 201);
	assert.equal((await post({ token, stars: 5, text: 'again' })).status, 409, 'the link works once');
	assert.deepEqual(await (await fetch(`${t.base}/api/reviews`)).json(), [], 'not public until published');
	const [mine] = await (await fetch(`${t.base}/api/admin/reviews`, { headers: t.auth })).json();
	await fetch(`${t.base}/api/admin/reviews/${mine.id}/publish`, { method: 'POST', headers: t.auth });
	const pub = await (await fetch(`${t.base}/api/reviews?home=easystay`)).json();
	assert.equal(pub[0].text, 'Lovely stay');
	assert.equal('tokenId' in pub[0] || 'ref' in pub[0], false, 'public view leaves out internals');
	await fetch(`${t.base}/api/admin/reviews/${mine.id}/hide`, { method: 'POST', headers: t.auth });
	assert.equal((await (await fetch(`${t.base}/api/reviews`)).json()).length, 0);
	t.close();
});

test('publish needs a deploy hook', async () => {
	const t = await boot();
	assert.equal((await fetch(`${t.base}/api/admin/publish`, { method: 'POST', headers: t.auth })).status, 503);
	t.close();
});

test('an unknown colour tone falls back to sky', async () => {
	const t = await boot();
	const r = await (await fetch(`${t.base}/api/admin/homes`, { method: 'POST', headers: t.auth, body: JSON.stringify({ name: 'Tone Test', rate: 10, sleeps: 1, tone: '"><script>' }) })).json();
	assert.equal(r.tone, 'sky');
	t.close();
});

// ---- double bookings ----
import { syncAll } from '../src/sync.js';
const basic = (d) => d.replaceAll('-', '');
const feed = (from, to) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:z@airbnb\r\nDTSTART;VALUE=DATE:${basic(from)}\r\nDTEND;VALUE=DATE:${basic(to)}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

test('a double booking: an unpaid website request gives way; a confirmed one is flagged once, then clears', async () => {
	const t = await boot();
	const events = [];
	const homes = [{ slug: 'easystay', name: 'EasyStay', feeds: { airbnb: 'https://airbnb.test/c.ics', booking: '' } }];
	const sync = (from, to) => syncAll({ store: t.store, homes, fetchImpl: async () => new Response(feed(from, to)), notify: async (e, b) => events.push([e, b.id]) });
	const book = (a, b) => fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'easystay', from: day(a), to: day(b), guests: 1, name: 'G', email: 'g@t.dev' }) }).then((r) => r.json());
	// Unpaid request first, then Airbnb reports the same nights: the request is cancelled automatically.
	const web = await book(10, 13);
	await sync(day(11), day(14));
	assert.equal((await t.store.list()).find((b) => b.id === web.id).status, 'cancelled');
	assert.deepEqual(events, [['cancelled', web.id]]);
	assert.deepEqual(await (await fetch(`${t.base}/api/admin/conflicts`, { headers: t.auth })).json(), []);
	// A confirmed website booking cannot be cancelled by us: it is flagged to the owner, once.
	const ok = await book(30, 33);
	await t.store.update(ok.id, { status: 'confirmed', holdUntil: undefined });
	events.length = 0;
	await sync(day(31), day(34));
	await sync(day(31), day(34));
	const open = await (await fetch(`${t.base}/api/admin/conflicts`, { headers: t.auth })).json();
	assert.equal(open.length, 1);
	assert.deepEqual(open[0].stays.map((s) => s.channel).sort(), ['airbnb', 'direct']);
	assert.deepEqual(events.map((e) => e[0]), ['conflict'], 'the owner is told once, not on every check');
	assert.equal((await fetch(`${t.base}/api/admin/conflicts`)).status, 401);
	await fetch(`${t.base}/api/admin/bookings/${ok.id}/cancel`, { method: 'POST', headers: t.auth });
	await sync(day(31), day(34));
	assert.deepEqual(await (await fetch(`${t.base}/api/admin/conflicts`, { headers: t.auth })).json(), [], 'cancelling one side clears it');
	t.close();
});

test('a booking that was paid or confirmed meanwhile is never auto-cancelled', async () => {
	const t = await boot();
	const homes = [{ slug: 'easystay', name: 'EasyStay', feeds: { airbnb: 'https://airbnb.test/c.ics', booking: '' } }];
	const b = await (await fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'easystay', from: day(10), to: day(13), guests: 1, name: 'G', email: 'g@t.dev' }) })).json();
	await t.store.update(b.id, { paidConflict: true });
	await syncAll({ store: t.store, homes, fetchImpl: async () => new Response(feed(day(11), day(14))) });
	assert.equal((await t.store.list()).find((x) => x.id === b.id).status, 'pending', 'left for the owner');
	assert.equal((await (await fetch(`${t.base}/api/admin/conflicts`, { headers: t.auth })).json()).length, 1);
	assert.equal(await t.store.update(b.id, { status: 'cancelled' }, (x) => x.status === 'confirmed'), null, 'the guard blocks the change');
	t.close();
});
