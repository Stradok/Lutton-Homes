import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	blockNights, activeBlocks, overlaps, isRangeFree, availabilityMap, bookedRanges,
} from '../src/availability.js';

const block = (over) => ({
	id: over.id ?? 'x', home: 'lakeside', from: '2026-05-01', to: '2026-05-03',
	channel: 'direct', status: 'confirmed', ...over,
});

test('same-day turnover is free', () => {
	const a = block({ from: '2026-05-01', to: '2026-05-03' });
	const b = block({ from: '2026-05-03', to: '2026-05-05' });
	assert.equal(overlaps(a, b), false);
	assert.equal(isRangeFree([a], 'lakeside', '2026-05-03', '2026-05-05'), true);
});

test('overlapping nights are detected, and only for the same home', () => {
	const a = block({ from: '2026-05-01', to: '2026-05-04' });
	const b = block({ from: '2026-05-03', to: '2026-05-06' });
	assert.equal(overlaps(a, b), true);
	assert.equal(overlaps(a, { ...b, home: 'other' }), false);
	assert.equal(isRangeFree([a], 'lakeside', '2026-05-02', '2026-05-03'), false);
});

test('cancelled blocks are ignored', () => {
	const cancelled = block({ status: 'cancelled' });
	assert.deepEqual(activeBlocks([cancelled], 'lakeside'), []);
	assert.equal(isRangeFree([cancelled], 'lakeside', '2026-05-01', '2026-05-03'), true);
});

test('isRangeFree is false for invalid dates and empty ranges', () => {
	assert.equal(isRangeFree([], 'lakeside', '2026-02-30', '2026-03-01'), false);
	assert.equal(isRangeFree([], 'lakeside', '2026-05-03', '2026-05-03'), false);
	assert.equal(isRangeFree([], 'lakeside', '2026-05-04', '2026-05-03'), false);
});

test('blockNights covers from inclusive and to exclusive', () => {
	assert.equal(blockNights(block({ from: '2026-05-01', to: '2026-05-04' })).length, 3);
	assert.deepEqual(blockNights(block({ from: '2026-05-03', to: '2026-05-03' })), []);
});

test('availabilityMap marks booked nights and prefers the earlier channel in CHANNELS', () => {
	const blocks = [
		block({ id: 'air', channel: 'airbnb', from: '2026-05-02', to: '2026-05-05' }),
		block({ id: 'dir', channel: 'direct', from: '2026-05-03', to: '2026-05-04' }),
	];
	const { days, channels } = availabilityMap(blocks, 'lakeside', '2026-05-01', 5);
	assert.deepEqual(days, {
		'2026-05-01': 'free',
		'2026-05-02': 'booked',
		'2026-05-03': 'booked',
		'2026-05-04': 'booked',
		'2026-05-05': 'free',
	});
	assert.deepEqual(channels, {
		'2026-05-02': 'airbnb',
		'2026-05-03': 'direct',
		'2026-05-04': 'airbnb',
	});
});

test('bookedRanges returns confirmed blocks for one home, sorted by from', () => {
	const blocks = [
		block({ id: 'b', from: '2026-06-01', to: '2026-06-02', channel: 'booking' }),
		block({ id: 'a', from: '2026-05-01', to: '2026-05-02', channel: 'airbnb' }),
		block({ id: 'c', home: 'other', from: '2026-05-01', to: '2026-05-02' }),
		block({ id: 'd', from: '2026-07-01', to: '2026-07-02', status: 'cancelled' }),
	];
	assert.deepEqual(bookedRanges(blocks, 'lakeside'), [
		{ from: '2026-05-01', to: '2026-05-02', channel: 'airbnb' },
		{ from: '2026-06-01', to: '2026-06-02', channel: 'booking' },
	]);
});
