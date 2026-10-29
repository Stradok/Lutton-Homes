// Store cache, security headers, health and the general rate limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const block = (n, m) => ({ home: 'easystay', from: day(n), to: day(m), channel: 'direct', status: 'confirmed' });

test('store cache: readers cannot change it, a failed write leaves it intact, an outside edit is noticed', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'lh-cache-'));
	const file = join(dir, 's.json');
	const s = createStore(file);
	await s.add(block(1, 3));
	const list = await s.list();
	list.length = 0; list.push({ junk: true });
	assert.equal((await s.list()).length, 1, 'changing the returned list does not change the store');
	await assert.rejects(s.add(block(2, 4)), (e) => e.code === 'OVERLAP');
	assert.equal((await s.list()).length, 1, 'a refused add leaves nothing behind');
	await assert.rejects(s.mutate('x', () => { throw new Error('boom'); }));
	assert.equal(await s.meta('x'), undefined);
	// A backup restored over the file while the server runs.
	const saved = JSON.parse(readFileSync(file, 'utf8'));
	saved.blocks = [];
	writeFileSync(file, JSON.stringify(saved, null, 2) + '\n\n\n');
	assert.equal((await s.list()).length, 0, 'the new file is read');
	rmSync(dir, { recursive: true, force: true });
});

async function boot() {
	const dir = mkdtempSync(join(tmpdir(), 'lh-hard-'));
	const config = { adminToken: '', sessionSecret: '', owners: {}, icalToken: '', allowedOrigins: [], homes: [{ slug: 'easystay', name: 'EasyStay', rate: 95, sleeps: 2, feeds: {} }] };
	const store = createStore(join(dir, 's.json'));
	const server = createServer(createApp({ config, store, notify: async () => {} }));
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	return { base: `http://127.0.0.1:${server.address().port}`, dir, close: () => { server.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('replies carry security headers, and health reads the store', async () => {
	const t = await boot();
	const r = await fetch(`${t.base}/api/health`);
	assert.equal(r.status, 200);
	for (const [k, v] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'no-referrer']]) assert.equal(r.headers.get(k), v);
	assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
	writeFileSync(join(t.dir, 's.json'), 'not json at all');
	assert.equal((await fetch(`${t.base}/api/health`)).status, 503, 'a damaged data file shows as unhealthy');
	t.close();
});

test('one address cannot flood the server', async () => {
	const t = await boot();
	let last;
	for (let i = 0; i < 305; i++) last = (await fetch(`${t.base}/api/health`)).status;
	assert.equal(last, 429);
	t.close();
});
