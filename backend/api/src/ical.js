// iCalendar import (Airbnb, Booking.com) and export (our availability feed).
// Hand-rolled because the feeds use a small, predictable subset of RFC 5545.

import { dayNumber, isoFromDay, isIsoDate } from './shapes.js';

// Property line: NAME[;params]:value. Params are ignored; only the value matters for us.
const PROP = /^([^:;]+)(?:;[^:]*)?:(.*)$/;

// Continuation lines start with a space or tab; the first character is folding, not content.
function unfold(text) {
	const lines = [];
	for (const raw of text.split(/\r?\n/)) {
		if (/^[ \t]/.test(raw) && lines.length) lines[lines.length - 1] += raw.slice(1);
		else lines.push(raw);
	}
	return lines;
}

const unescapeText = (s) => s.replace(/\\([\\,;nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
const escapeText = (s) => String(s).replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n');

// isIsoDate from shapes.js throws on impossible dates (month 13), so reject NaN dates before calling it.
const validDay = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && isIsoDate(s);

// DATE, DATE-TIME and TZID-qualified values all start with YYYYMMDD; the time is dropped on purpose.
function icalDate(value) {
	if (typeof value !== 'string' || !/^\d{8}/.test(value)) return null;
	const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
	return validDay(iso) ? iso : null;
}

function toBlock(ev, home, channel) {
	if (ev.get('STATUS')?.trim().toUpperCase() === 'CANCELLED') return null;
	const from = icalDate(ev.get('DTSTART'));
	if (!from) return null;
	// A missing DTEND means a one-night block. A DTEND that is present but unreadable is not guessed at.
	const to = ev.get('DTEND') ? icalDate(ev.get('DTEND')) : isoFromDay(dayNumber(from) + 1);
	if (!to || dayNumber(to) <= dayNumber(from)) return null;
	const uid = ev.get('UID') ? unescapeText(ev.get('UID')).trim() : '';
	const guest = ev.get('SUMMARY') ? unescapeText(ev.get('SUMMARY')).trim() : '';
	const block = {
		// Generated ids are stable across re-syncs, so the same stay is not imported twice.
		id: uid || `${channel}-${home}-${from}-${to}`,
		home,
		from,
		to,
		channel,
		status: 'confirmed',
	};
	if (guest) block.guest = guest;
	block.createdAt = new Date().toISOString();
	return block;
}

export function parseIcal(text, { home, channel } = {}) {
	if (typeof text !== 'string') return [];
	const blocks = [];
	let event = null;
	for (const line of unfold(text)) {
		const prop = PROP.exec(line);
		if (!prop) continue;
		const name = prop[1].toUpperCase();
		const value = prop[2];
		if (name === 'BEGIN' && value.toUpperCase() === 'VEVENT') {
			event = new Map();
		} else if (name === 'END' && value.toUpperCase() === 'VEVENT') {
			const block = event && toBlock(event, home, channel);
			if (block) blocks.push(block);
			event = null;
		} else if (event) {
			event.set(name, value);
		}
	}
	return blocks;
}

// RFC 5545 caps lines at 75 octets. Continuations start with a space, so they carry 74 more.
// Split by code point so a UTF-8 character is never cut in half.
function fold(line) {
	if (Buffer.byteLength(line) <= 75) return line;
	const parts = [];
	let cur = '';
	let max = 75;
	for (const ch of line) {
		if (Buffer.byteLength(cur + ch) > max) {
			parts.push(cur);
			cur = '';
			max = 74;
		}
		cur += ch;
	}
	parts.push(cur);
	return parts.join('\r\n ');
}

export function buildIcal({ name = '', blocks = [] } = {}) {
	const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Luton Homes//Availability//EN',
		'CALSCALE:GREGORIAN',
		`X-WR-CALNAME:${escapeText(name)}`,
	];
	for (const b of blocks) {
		// Only confirmed stays are published. Guest names are never written: other sites import this feed.
		if (b.status !== 'confirmed' || !validDay(b.from) || !validDay(b.to)) continue;
		lines.push(
			'BEGIN:VEVENT',
			`UID:${escapeText(`${b.id}@lutonhomes`)}`,
			`DTSTAMP:${stamp}`,
			`DTSTART;VALUE=DATE:${b.from.replaceAll('-', '')}`,
			`DTEND;VALUE=DATE:${b.to.replaceAll('-', '')}`,
			'SUMMARY:Reserved',
			'END:VEVENT',
		);
	}
	lines.push('END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}
