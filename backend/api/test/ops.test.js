import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '../src/log.js';
import { validateConfig, assertConfig } from '../src/validate.js';

function collector(level) {
	const lines = [];
	const log = createLogger({ level, write: (line) => lines.push(line) });
	return { lines, log };
}

test('log drops messages below the level', () => {
	const { lines, log } = collector('warn');
	log.debug('d');
	log.info('i');
	log.warn('w');
	log.error('e');
	assert.deepEqual(lines.map((l) => JSON.parse(l).level), ['warn', 'error']);
});

test('log writes one JSON line per call with fields', () => {
	const { lines, log } = collector('debug');
	log.info('booked', { id: 7, ok: true });
	assert.equal(lines.length, 1);
	assert.ok(!lines[0].includes('\n'));
	const row = JSON.parse(lines[0]);
	assert.equal(row.level, 'info');
	assert.equal(row.msg, 'booked');
	assert.equal(row.id, 7);
	assert.equal(row.ok, true);
	assert.ok(!Number.isNaN(Date.parse(row.time)));
});

test('log turns Error fields into name and message only', () => {
	const { lines, log } = collector('debug');
	log.error('failed', { err: new RangeError('bad range') });
	const row = JSON.parse(lines[0]);
	assert.deepEqual(row.err, { name: 'RangeError', message: 'bad range' });
});

test('log never throws on a circular object', () => {
	const { lines, log } = collector('debug');
	const loop = {};
	loop.self = loop;
	assert.doesNotThrow(() => log.warn('loop', { loop }));
	const row = JSON.parse(lines[0]);
	assert.equal(row.msg, 'loop');
	assert.equal(row.level, 'warn');
});

test('log never throws when the sink fails', () => {
	const log = createLogger({ write: () => { throw new Error('disk full'); } });
	assert.doesNotThrow(() => log.error('x'));
});

const good = {
	sessionSecret: 'a'.repeat(32),
	adminToken: 'b'.repeat(24),
	owners: { amman: 'scrypt$abc' },
	icalToken: 'c'.repeat(24),
	allowedOrigins: ['https://site.example'],
	apiUrl: 'https://api.example',
	siteUrl: 'https://site.example',
	paymentProvider: 'stripe',
	mailProvider: 'smtp',
	deployHook: 'https://hooks.example/deploy',
	trustProxy: true,
};
const prod = { NODE_ENV: 'production' };
const withBad = (patch) => ({ ...good, ...patch });

test('validate returns nothing outside production', () => {
	const bad = withBad({ allowedOrigins: [], apiUrl: 'http://x' });
	assert.deepEqual(validateConfig(bad, { NODE_ENV: 'development' }), []);
});

test('validate accepts a good production config', () => {
	assert.deepEqual(validateConfig(good, prod), []);
});

test('validate flags a short session secret when owners exist', () => {
	const problems = validateConfig(withBad({ sessionSecret: 'short' }), prod);
	assert.equal(problems.length, 1);
	assert.match(problems[0], /SESSION_SECRET/);
});

test('validate flags a missing owner and admin token', () => {
	const problems = validateConfig(withBad({ owners: {}, adminToken: undefined }), prod);
	assert.ok(problems.some((p) => p.includes('No owner accounts or ADMIN_TOKEN')));
});

test('validate flags a short admin token', () => {
	const problems = validateConfig(withBad({ adminToken: 'short' }), prod);
	assert.match(problems[0], /ADMIN_TOKEN/);
});

test('validate flags a short ical token', () => {
	const problems = validateConfig(withBad({ icalToken: 'short' }), prod);
	assert.match(problems[0], /ICAL_TOKEN/);
});

test('validate flags empty or non-https allowed origins', () => {
	assert.match(validateConfig(withBad({ allowedOrigins: [] }), prod)[0], /ALLOWED_ORIGINS/);
	assert.match(validateConfig(withBad({ allowedOrigins: ['http://a.example'] }), prod)[0], /ALLOWED_ORIGINS/);
});

test('validate flags non-https API_PUBLIC_URL, SITE_URL and DEPLOY_HOOK_URL', () => {
	assert.match(validateConfig(withBad({ apiUrl: 'http://api' }), prod)[0], /API_PUBLIC_URL/);
	assert.match(validateConfig(withBad({ siteUrl: 'http://site' }), prod)[0], /SITE_URL/);
	assert.match(validateConfig(withBad({ deployHook: 'http://hook' }), prod)[0], /DEPLOY_HOOK_URL/);
});

test('validate flags owner hashes that are not scrypt', () => {
	const problems = validateConfig(withBad({ owners: { amman: 'plain' } }), prod);
	assert.match(problems[0], /OWNERS/);
});

test('assertConfig throws with every problem listed', () => {
	const bad = withBad({ sessionSecret: 'short', apiUrl: 'http://api', owners: { amman: 'plain' } });
	assert.throws(() => assertConfig(bad, prod), (err) => {
		assert.ok(err.message.includes('SESSION_SECRET'));
		assert.ok(err.message.includes('API_PUBLIC_URL'));
		assert.ok(err.message.includes('OWNERS'));
		assert.equal(err.message.split('\n').length, 3);
		return true;
	});
});

test('assertConfig passes a good production config', () => {
	assert.doesNotThrow(() => assertConfig(good, prod));
});
