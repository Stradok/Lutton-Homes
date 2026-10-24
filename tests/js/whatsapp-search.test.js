// Plain Node test for the WhatsApp search helper. Run: node tests/js/whatsapp-search.test.js
'use strict';

const assert = require('node:assert');
const path = require('node:path');

const { buildWhatsAppUrl } = require(path.join(
  __dirname, '..', '..', 'frontend', 'luton-homes', 'assets', 'js', 'whatsapp-search.js'
));

const NUMBER = '447934586612';
const MESSAGE = 'Hello Luton Homes, I would like to check availability from 12 Nov 2026 to 15 Nov 2026 for 2 guests.';

let failed = 0;

function check(name, fn) {
	try {
		fn();
		console.log('ok - ' + name);
	} catch (err) {
		failed += 1;
		console.error('not ok - ' + name + '\n  ' + err.message);
	}
}

check('builds the exact wa.me URL with an encoded message for 2 guests', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', 2),
		'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(MESSAGE)
	);
});

check('uses the singular "guest" for one guest', () => {
	const url = buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', 1);
	assert.strictEqual(
		url,
		'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(
			'Hello Luton Homes, I would like to check availability from 12 Nov 2026 to 15 Nov 2026 for 1 guest.'
		)
	);
});

check('accepts a guests value taken from a form input (string digits)', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', '2'),
		buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', 2)
	);
});

check('returns null when check-out equals check-in', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-12', 2), null);
});

check('returns null when check-out is before check-in', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-15', '2026-11-12', 2), null);
});

check('returns null when a date is missing', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '', '2026-11-15', 2), null);
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', undefined, 2), null);
});

check('returns null when a date is not YYYY-MM-DD', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '12/11/2026', '2026-11-15', 2), null);
});

check('returns null for a date that does not exist', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-02-30', '2026-03-05', 2), null);
});

check('returns null when guests is 0', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', 0), null);
});

check('returns null when guests is not a number', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', 'abc'), null);
});

function message(text) {
	return 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(text);
}

check('accepts 29 February in a leap year', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2028-02-29', '2028-03-01', 2),
		message('Hello Luton Homes, I would like to check availability from 29 Feb 2028 to 1 Mar 2028 for 2 guests.')
	);
});

check('returns null for 29 February in a non-leap year', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2027-02-29', '2027-03-02', 2), null);
});

check('returns null for 30 February', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-02-30', '2026-03-02', 2), null);
});

check('formats a range across the year boundary', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2026-12-31', '2027-01-02', 2),
		message('Hello Luton Homes, I would like to check availability from 31 Dec 2026 to 2 Jan 2027 for 2 guests.')
	);
});

check('formats September as "Sep" with no leading zero on the day', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2026-09-01', '2026-09-03', 2),
		message('Hello Luton Homes, I would like to check availability from 1 Sep 2026 to 3 Sep 2026 for 2 guests.')
	);
});

check('returns null for guests 2.5', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', 2.5), null);
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', '2.5'), null);
});

check('accepts surrounding whitespace in a numeric string and counts the number', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', ' 3 '),
		message('Hello Luton Homes, I would like to check availability from 12 Nov 2026 to 15 Nov 2026 for 3 guests.')
	);
});

check('returns null for a whitespace-only guests value', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', '   '), null);
});

check('returns null for guests 1e3 (exponent form)', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', '1e3'), null);
});

check('returns null for a digit string beyond the safe integer range', () => {
	assert.strictEqual(buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', '100000000000000000000'), null);
});

check('accepts guests as a number', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', 4),
		message('Hello Luton Homes, I would like to check availability from 12 Nov 2026 to 15 Nov 2026 for 4 guests.')
	);
});

check('uses the singular "guest" for guests 1 given as a string', () => {
	assert.strictEqual(
		buildWhatsAppUrl(NUMBER, '2026-11-12', '2026-11-15', '1'),
		message('Hello Luton Homes, I would like to check availability from 12 Nov 2026 to 15 Nov 2026 for 1 guest.')
	);
});

if (failed > 0) {
	console.error(failed + ' failed');
	process.exit(1);
}
console.log('all passed');
