// Backs up the JSON store and the uploaded photos.
// Run it from cron or a scheduled job, and copy the backup folder off the server.
// Usage: node scripts/backup.js   (env: DATA_FILE, UPLOADS_DIR, BACKUP_DIR, BACKUP_KEEP)
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pad = (n) => String(n).padStart(2, '0');

function stamp(now) {
	return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
		+ `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export async function backupStore({ dataFile, uploadsDir, outDir, keep = 14, now = new Date() }) {
	if (!existsSync(dataFile)) throw new Error('No data file at ' + dataFile);
	await fs.mkdir(outDir, { recursive: true });

	const file = path.join(outDir, `store-${stamp(now)}.json`);
	await fs.copyFile(dataFile, file);

	// Photo names are random and never change, so an existing name means the photo is already backed up.
	let uploads = 0;
	if (uploadsDir && existsSync(uploadsDir)) {
		const dest = path.join(outDir, 'uploads');
		await fs.mkdir(dest, { recursive: true });
		for (const entry of await fs.readdir(uploadsDir, { withFileTypes: true })) {
			if (!entry.isFile() || existsSync(path.join(dest, entry.name))) continue;
			await fs.copyFile(path.join(uploadsDir, entry.name), path.join(dest, entry.name));
			uploads++;
		}
	}

	// Names embed a UTC timestamp, so sorting by name sorts by time. Only store-*.json files are ever removed.
	const copies = (await fs.readdir(outDir))
		.filter((name) => /^store-.*\.json$/.test(name))
		.sort();
	const old = copies.slice(0, Math.max(0, copies.length - keep));
	for (const name of old) await fs.rm(path.join(outDir, name));

	return { file, kept: copies.length - old.length, uploads };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const data = path.join(here, '..', 'data');
	try {
		const result = await backupStore({
			dataFile: process.env.DATA_FILE || path.join(data, 'store.json'),
			uploadsDir: process.env.UPLOADS_DIR || path.join(data, 'uploads'),
			outDir: process.env.BACKUP_DIR || path.join(data, 'backups'),
			keep: Number(process.env.BACKUP_KEEP || 14),
		});
		console.log(`Backed up to ${result.file}; kept ${result.kept} copies; ${result.uploads} new photos`);
	} catch (err) {
		console.error(err.message);
		process.exit(1);
	}
}
