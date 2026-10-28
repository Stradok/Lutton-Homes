import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.js';
import { isoFromDay, dayNumber } from '../src/shapes.js';

const block = (over) => ({
	home: 'lakeside', from: '2026-05-01', to: '2026-05-03',
	channel: 'direct', status: 'confirmed', ...over,
});

// Fresh file in a unique temp dir, removed when the test ends.
async function tmpFile(t) {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'luton-store-'));
	t.after(() => fs.rm(dir, { recursive: true, force: true }));
	return path.join(dir, 'store.json');
}

test('add, list, update and remove', async (t) => {
	const store = createStore(await tmpFile(t));
	const added = await store.add(block({}));
	assert.ok(added.id, 'id generated');
	assert.ok(added.createdAt, 'createdAt filled');
	assert.deepEqual(await store.list(), [added]);

	const updated = await store.update(added.id, { status: 'cancelled' });
	assert.equal(updated.status, 'cancelled');
	assert.equal(await store.update('missing', {}), null);

	assert.equal(await store.remove(added.id), true);
	assert.equal(await store.remove(added.id), false);
	assert.deepEqual(await store.list(), []);
});

test('add rejects an overlapping confirmed block with OVERLAP', async (t) => {
	const store = createStore(await tmpFile(t));
	await store.add(block({ from: '2026-05-01', to: '2026-05-04' }));
	await assert.rejects(store.add(block({ from: '2026-05-03', to: '2026-05-05' })), { code: 'OVERLAP' });
	// Same-day turnover is fine.
	await store.add(block({ from: '2026-05-04', to: '2026-05-06' }));
	assert.equal((await store.list()).length, 2);
});

test('update that would overlap rejects with OVERLAP', async (t) => {
	const store = createStore(await tmpFile(t));
	await store.add(block({ from: '2026-05-01', to: '2026-05-03' }));
	const second = await store.add(block({ from: '2026-06-01', to: '2026-06-03' }));
	await assert.rejects(store.update(second.id, { from: '2026-05-02' }), { code: 'OVERLAP' });
});

test('invalid dates, channel and status reject with INVALID', async (t) => {
	const store = createStore(await tmpFile(t));
	await assert.rejects(store.add(block({ from: '2026-02-30' })), { code: 'INVALID' });
	await assert.rejects(store.add(block({ to: '05/03/2026' })), { code: 'INVALID' });
	await assert.rejects(store.add(block({ from: '2026-05-03', to: '2026-05-03' })), { code: 'INVALID' });
	await assert.rejects(store.add(block({ channel: 'vrbo' })), { code: 'INVALID' });
	await assert.rejects(store.add(block({ status: 'maybe' })), { code: 'INVALID' });
	assert.deepEqual(await store.list(), []);
});

test('replaceChannel touches only its own home and channel, and skips the overlap check', async (t) => {
	const store = createStore(await tmpFile(t));
	await store.add(block({ channel: 'direct', from: '2026-05-01', to: '2026-05-03' }));
	await store.add(block({ channel: 'airbnb', from: '2026-06-01', to: '2026-06-03' }));
	await store.add(block({ channel: 'airbnb', home: 'other', from: '2026-06-01', to: '2026-06-03' }));

	const count = await store.replaceChannel('lakeside', 'airbnb', [
		{ from: '2026-05-02', to: '2026-05-05', status: 'confirmed' },
		{ from: '2026-05-04', to: '2026-05-06', status: 'confirmed' },
	]);
	assert.equal(count, 2);

	const all = await store.list();
	const lakesideAirbnb = all.filter((b) => b.home === 'lakeside' && b.channel === 'airbnb');
	assert.equal(lakesideAirbnb.length, 2);
	assert.equal(all.filter((b) => b.channel === 'direct').length, 1);
	assert.equal(all.filter((b) => b.home === 'other').length, 1);
	assert.equal(all.length, 4);
});

test('meta stores and returns small values', async (t) => {
	const store = createStore(await tmpFile(t));
	assert.equal(await store.meta('lastSync'), undefined);
	await store.meta('lastSync', '2026-10-28T10:00:00Z');
	assert.equal(await store.meta('lastSync'), '2026-10-28T10:00:00Z');
});

test('creates the file when missing', async (t) => {
	const file = await tmpFile(t);
	const store = createStore(file);
	assert.deepEqual(await store.list(), []);
	assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { blocks: [], meta: {} });
});

test('data persists across two store instances on the same file', async (t) => {
	const file = await tmpFile(t);
	const first = createStore(file);
	const added = await first.add(block({}));
	await first.meta('k', 'v');

	const second = createStore(file);
	assert.deepEqual(await second.list(), [added]);
	assert.equal(await second.meta('k'), 'v');
	await second.add(block({ from: '2026-07-01', to: '2026-07-02' }));
	assert.equal((await first.list()).length, 2);
});

test('concurrent adds do not lose data', async (t) => {
	const store = createStore(await tmpFile(t));
	const base = dayNumber('2026-01-01');
	const adds = Array.from({ length: 20 }, (_, i) =>
		store.add(block({ from: isoFromDay(base + i), to: isoFromDay(base + i + 1) })));
	await Promise.all(adds);
	assert.equal((await store.list()).length, 20);
});
