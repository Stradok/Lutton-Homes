// Pending holds, payment webhook, owner confirm, sign-in sessions and the email slot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';
import { hashPassword, verifyPassword, signSession, verifySession, parseOwners } from '../src/auth.js';
import { createNotifier, registerMailer } from '../src/notify.js';
import { getProvider } from '../src/payments.js';

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const hash = hashPassword('correct horse');

async function boot(extra = {}) {
	const dir = mkdtempSync(join(tmpdir(), 'lh-flow-'));
	const config = { adminToken: '', sessionSecret: 's3cret', owners: { admin: hash }, paymentProvider: 'fake', icalToken: 't', allowedOrigins: [], holdMinutes: 30,
		homes: [{ slug: 'easystay', name: 'EasyStay', rate: 95, sleeps: 2, feeds: {} }], ...extra };
	const store = createStore(join(dir, 'store.json'));
	const sent = [];
	const payments = { name: 'fake', createCheckout: async ({ booking }) => ({ url: 'https://pay.test/' + booking.id, ref: 'ref_' + booking.id }),
		parseWebhook: async ({ headers, raw }) => (headers['x-sig'] === 'ok' ? JSON.parse(raw) : null) };
	const server = createServer(createApp({ config, store, payments, notify: async (e, b) => sent.push([e, b.id]) }));
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const base = `http://127.0.0.1:${server.address().port}`;
	return { base, store, sent, close: () => { server.close(); rmSync(dir, { recursive: true, force: true }); } };
}
const book = (t, from = 10, to = 12) => fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'easystay', from: day(from), to: day(to), guests: 2, name: 'G', email: 'g@test.dev' }) });
const login = async (t) => (await (await fetch(`${t.base}/api/admin/login`, { method: 'POST', body: JSON.stringify({ user: 'admin', password: 'correct horse' }) })).json()).token;

test('a booking is pending, holds its nights, returns a pay link, and needs an email', async () => {
	const t = await boot();
	assert.equal((await fetch(`${t.base}/api/bookings`, { method: 'POST', body: JSON.stringify({ home: 'easystay', from: day(10), to: day(12), guests: 1, name: 'G' }) })).status, 400);
	const r = await book(t), b = await r.json();
	assert.equal(r.status, 201);
	assert.equal(b.status, 'pending');
	assert.match(b.checkoutUrl, /^https:\/\/pay\.test\//);
	assert.equal((await book(t)).status, 409, 'the hold blocks a second guest');
	assert.deepEqual(t.sent, [['requested', b.id]]);
	t.close();
});

test('an expired hold frees the nights again', async () => {
	const t = await boot();
	const b = await (await book(t)).json();
	await t.store.update(b.id, { holdUntil: new Date(Date.now() - 1000).toISOString() });
	assert.equal((await book(t)).status, 201);
	t.close();
});

test('the payment webhook confirms a booking; a bad signature is ignored; a failure frees the nights', async () => {
	const t = await boot();
	const b = await (await book(t)).json();
	const hook = (sig, body) => fetch(`${t.base}/api/payments/webhook/fake`, { method: 'POST', headers: { 'x-sig': sig }, body: JSON.stringify(body) });
	await hook('bad', { bookingId: b.id, paid: true });
	assert.equal((await t.store.list())[0].status, 'pending');
	await hook('ok', { bookingId: b.id, paid: true });
	assert.equal((await t.store.list())[0].status, 'confirmed');
	assert.equal((await fetch(`${t.base}/api/payments/webhook/other`, { method: 'POST', body: '{}' })).status, 404);
	const c = await (await book(t, 20, 22)).json();
	await hook('ok', { bookingId: c.id, paid: false });
	assert.equal((await t.store.list()).find((x) => x.id === c.id).status, 'cancelled');
	t.close();
});

test('owners sign in for a session; wrong passwords, unknown names and tampered tokens are refused; the owner can confirm and cancel', async () => {
	const t = await boot();
	const bad = (user, password) => fetch(`${t.base}/api/admin/login`, { method: 'POST', body: JSON.stringify({ user, password }) });
	assert.equal((await bad('admin', 'wrong')).status, 401);
	assert.equal((await bad('nobody', 'correct horse')).status, 401);
	assert.equal((await bad('__proto__', 'x')).status, 401);
	const token = await login(t), auth = { authorization: 'Bearer ' + token };
	assert.equal((await fetch(`${t.base}/api/admin/bookings`)).status, 401);
	assert.equal((await fetch(`${t.base}/api/admin/bookings`, { headers: { authorization: 'Bearer ' + token.slice(0, -2) + 'xx' } })).status, 401);
	const b = await (await book(t)).json();
	const ok = await fetch(`${t.base}/api/admin/bookings/${b.id}/confirm`, { method: 'POST', headers: auth });
	assert.equal((await ok.json()).status, 'confirmed');
	await fetch(`${t.base}/api/admin/bookings/${b.id}/cancel`, { method: 'POST', headers: auth });
	assert.equal((await t.store.list())[0].status, 'cancelled');
	assert.deepEqual(t.sent.map((s) => s[0]), ['requested', 'confirmed', 'cancelled']);
	t.close();
});

test('login is rate limited', async () => {
	const t = await boot();
	let last;
	for (let i = 0; i < 7; i++) last = (await fetch(`${t.base}/api/admin/login`, { method: 'POST', body: JSON.stringify({ user: 'admin', password: 'x' }) })).status;
	assert.equal(last, 429);
	t.close();
});

test('passwords and sessions', () => {
	assert.ok(verifyPassword('correct horse', hash));
	assert.ok(!verifyPassword('nope', hash));
	assert.ok(!verifyPassword('x', 'garbage'));
	const tok = signSession('admin', 'k', 1000, 5000);
	assert.equal(verifySession(tok, 'k', 5500), 'admin');
	assert.equal(verifySession(tok, 'k', 7000), null, 'expired');
	assert.equal(verifySession(tok, 'other', 5500), null, 'wrong secret');
	assert.deepEqual(parseOwners(`a:scrypt$x$y, b:scrypt$p$q`), { a: 'scrypt$x$y', b: 'scrypt$p$q' });
});

test('email slot: a registered mailer gets guest and owner messages, and a failing mailer never throws', async () => {
	const out = [];
	registerMailer({ name: 'cap', send: async (m) => out.push(m) });
	registerMailer({ name: 'boom', send: async () => { throw new Error('smtp down'); } });
	const booking = { id: 'x', home: 'easystay', from: '2030-01-01', to: '2030-01-03', guest: 'G', email: 'g@test.dev', total: 225 };
	await createNotifier({ mailer: 'cap', ownerEmail: 'owner@test.dev', homes: [{ slug: 'easystay', name: 'EasyStay' }] })('confirmed', booking);
	assert.deepEqual(out.map((m) => m.to), ['g@test.dev', 'owner@test.dev']);
	await createNotifier({ mailer: 'boom', ownerEmail: 'o@test.dev' })('requested', booking);
	assert.throws(() => createNotifier({ mailer: 'nope' }));
	assert.throws(() => getProvider('nope'));
	assert.equal(getProvider().name, 'manual');
});
