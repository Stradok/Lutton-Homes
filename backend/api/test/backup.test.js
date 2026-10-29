import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { backupStore } from '../scripts/backup.js';

// Temp root with a fake store, two photos, and an empty backup folder; removed when the test ends.
async function setup(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'luton-backup-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const dataFile = path.join(root, 'store.json');
	const uploadsDir = path.join(root, 'uploads');
	const outDir = path.join(root, 'backups');
	await fs.writeFile(dataFile, '{"bookings":[1]}');
	await fs.mkdir(uploadsDir);
	await fs.writeFile(path.join(uploadsDir, 'a1b2.jpg'), 'photo-a');
	await fs.writeFile(path.join(uploadsDir, 'c3d4.jpg'), 'photo-b');
	return { root, dataFile, uploadsDir, outDir };
}

const at = (iso) => new Date(iso);

test('copies the store with a UTC timestamp name and the photos', async (t) => {
	const s = await setup(t);
	const r = await backupStore({ ...s, now: at('2026-10-29T08:05:09Z') });
	assert.equal(path.basename(r.file), 'store-20261029-080509.json');
	assert.equal(await fs.readFile(r.file, 'utf8'), '{"bookings":[1]}');
	assert.equal(r.kept, 1);
	assert.equal(r.uploads, 2);
	assert.equal(await fs.readFile(path.join(s.outDir, 'uploads', 'a1b2.jpg'), 'utf8'), 'photo-a');
});

test('second run copies no photos that are already there', async (t) => {
	const s = await setup(t);
	await backupStore({ ...s, now: at('2026-10-29T08:00:00Z') });
	const r = await backupStore({ ...s, now: at('2026-10-29T09:00:00Z') });
	assert.equal(r.uploads, 0);
	assert.equal(r.kept, 2);
});

test('keep: 2 after 4 runs leaves the newest two store files', async (t) => {
	const s = await setup(t);
	for (const h of ['01', '02', '03', '04']) {
		await backupStore({ ...s, keep: 2, now: at(`2026-10-29T${h}:00:00Z`) });
	}
	const files = (await fs.readdir(s.outDir)).filter((n) => n.startsWith('store-')).sort();
	assert.deepEqual(files, ['store-20261029-030000.json', 'store-20261029-040000.json']);
});

test('missing data file throws and writes nothing', async (t) => {
	const s = await setup(t);
	const missing = path.join(s.root, 'nope.json');
	await assert.rejects(
		backupStore({ ...s, dataFile: missing }),
		{ message: 'No data file at ' + missing },
	);
	await assert.rejects(fs.access(s.outDir));
});

test('only touches outDir', async (t) => {
	const s = await setup(t);
	const before = (await fs.readdir(s.root)).sort();
	const sourceBefore = await fs.readFile(s.dataFile, 'utf8');
	await backupStore({ ...s, keep: 1, now: at('2026-10-29T01:00:00Z') });
	await backupStore({ ...s, keep: 1, now: at('2026-10-29T02:00:00Z') });
	// The only new entry in the root is outDir itself.
	assert.deepEqual((await fs.readdir(s.root)).sort(), [...before, 'backups'].sort());
	assert.deepEqual(await fs.readdir(s.uploadsDir), ['a1b2.jpg', 'c3d4.jpg']);
	assert.equal(await fs.readFile(s.dataFile, 'utf8'), sourceBefore);
	assert.equal(await fs.readFile(path.join(s.uploadsDir, 'a1b2.jpg'), 'utf8'), 'photo-a');
});
