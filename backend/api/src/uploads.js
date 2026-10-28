// Photo uploads kept on disk next to the data file and served back by the API. Only real images are accepted:
// the file's first bytes are checked, so a renamed script or page never gets stored.
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { HttpError } from './http.js';

export const MAX_BYTES = 6_000_000;
const TYPES = [
	['jpg', 'image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
	['png', 'image/png', (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
	['webp', 'image/webp', (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'],
];

export async function saveImage(dir, bytes) {
	const type = TYPES.find(([, , ok]) => ok(bytes));
	if (!type) throw new HttpError(415, 'Only JPEG, PNG or WebP photos are accepted');
	const name = `${randomBytes(12).toString('hex')}.${type[0]}`;
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(join(dir, name), bytes);
	return name;
}

export async function readImage(dir, name) {
	const type = TYPES.find(([ext]) => name.endsWith('.' + ext));
	if (!type || !/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name)) throw new HttpError(404, 'Not found');
	try { return { bytes: await fs.readFile(join(dir, name)), mime: type[1] }; } catch { throw new HttpError(404, 'Not found'); }
}
