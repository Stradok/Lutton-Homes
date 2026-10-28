// JSON-file store. Callers only see the async methods below, so a database can replace this file later.
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { CHANNELS, STATUSES, dayNumber, isIsoDate } from './shapes.js';
import { activeBlocks, holds, overlaps } from './availability.js';

const PRUNE_AFTER_MS = 48 * 3600_000;

// Callers branch on err.code ('OVERLAP' | 'INVALID') instead of parsing messages.
function fail(code, message) {
	const err = new Error(message);
	err.code = code;
	return err;
}

function assertValid(b) {
	if (typeof b.home !== 'string' || !b.home) throw fail('INVALID', 'home is required');
	if (!isIsoDate(b.from) || !isIsoDate(b.to) || dayNumber(b.to) <= dayNumber(b.from)) {
		throw fail('INVALID', `bad dates: ${b.from} to ${b.to}`);
	}
	if (!CHANNELS.includes(b.channel)) throw fail('INVALID', `unknown channel: ${b.channel}`);
	if (!STATUSES.includes(b.status)) throw fail('INVALID', `unknown status: ${b.status}`);
}

// Cancelled blocks do not hold nights, so only confirmed and pending ones are checked against the calendar.
function assertNoOverlap(blocks, candidate) {
	if (!holds(candidate)) return; // cancelled, or a pending request whose hold has run out
	const clash = activeBlocks(blocks, candidate.home).some((b) => b.id !== candidate.id && overlaps(b, candidate));
	if (clash) throw fail('OVERLAP', `overlaps an existing booking on ${candidate.home}`);
}

function withDefaults(b) {
	return { ...b, id: b.id ?? randomUUID(), createdAt: b.createdAt ?? new Date().toISOString() };
}

export function createStore(filePath) {
	// Every operation waits for the one before it, so read-modify-write cycles never interleave.
	let queue;
	function serial(fn) {
		const run = queue.then(fn);
		queue = run.catch(() => {});
		return run;
	}

	async function read() {
		let text;
		try {
			text = await fs.readFile(filePath, 'utf8');
		} catch (err) {
			if (err.code !== 'ENOENT') throw err;
			const empty = { blocks: [], meta: {} };
			await write(empty);
			return empty;
		}
		const data = JSON.parse(text);
		return { blocks: data.blocks ?? [], meta: data.meta ?? {} };
	}

	// Temp file in the same directory, then rename: a reader never sees a half-written file.
	async function write(data) {
		await fs.mkdir(dirname(filePath), { recursive: true }); // a fresh deploy has no data folder yet
		const tmp = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
		await fs.writeFile(tmp, JSON.stringify(data, null, '\t'));
		await fs.rename(tmp, filePath);
	}

	// Creates the file now if missing. A bad file is reported by the first real operation, not here.
	queue = read().catch(() => {});

	return {
		list: () => serial(async () => (await read()).blocks),

		add: (block) => serial(async () => {
			const data = await read();
			const next = withDefaults(block);
			assertValid(next);
			// Abandoned requests are dropped only 48 hours after their hold ran out, long after any checkout page or late payment
			// could still refer to them, so the file does not grow forever.
			data.blocks = data.blocks.filter((b) => b.status !== 'pending' || b.paidConflict || Date.parse(b.holdUntil) + PRUNE_AFTER_MS > Date.now());
			if (data.blocks.some((b) => b.id === next.id)) throw fail('INVALID', `duplicate id: ${next.id}`);
			assertNoOverlap(data.blocks, next);
			data.blocks.push(next);
			await write(data);
			return next;
		}),

		update: (id, patch) => serial(async () => {
			const data = await read();
			const i = data.blocks.findIndex((b) => b.id === id);
			if (i < 0) return null;
			const next = { ...data.blocks[i], ...patch, id };
			assertValid(next);
			assertNoOverlap(data.blocks, next);
			data.blocks[i] = next;
			await write(data);
			return next;
		}),

		remove: (id) => serial(async () => {
			const data = await read();
			const kept = data.blocks.filter((b) => b.id !== id);
			if (kept.length === data.blocks.length) return false;
			await write({ ...data, blocks: kept });
			return true;
		}),

		// Calendar sync: external feeds may overlap each other and direct bookings, so no overlap check here.
		replaceChannel: (home, channel, blocks) => serial(async () => {
			const data = await read();
			const incoming = blocks.map((b) => withDefaults({ ...b, home, channel }));
			incoming.forEach((b) => assertValid(b));
			data.blocks = [
				...data.blocks.filter((b) => !(b.home === home && b.channel === channel)),
				...incoming,
			];
			await write(data);
			return incoming.length;
		}),

		// Atomic change to one collection kept in meta: fn gets the current value and returns the new one. If fn throws, nothing is written.
		mutate: (key, fn) => serial(async () => {
			const data = await read();
			data.meta[key] = fn(data.meta[key]);
			await write(data);
			return data.meta[key];
		}),

		// meta(key) reads, meta(key, value) writes and returns the value.
		meta: (key, value) => serial(async () => {
			const data = await read();
			if (value === undefined) return data.meta[key];
			data.meta[key] = value;
			await write(data);
			return value;
		}),
	};
}
