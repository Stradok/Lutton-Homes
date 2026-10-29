import { log } from './log.js';
// Email slot. A mailer is { send: async ({ to, subject, text }) => void }. The default writes to the log, so nothing is
// emailed until a real provider (SMTP, Postmark, SendGrid, Resend) is registered and MAIL_PROVIDER is set.
// Logs only the address's domain: a log file should not collect guests' email addresses.
const logMailer = { name: 'log', send: async ({ to, subject }) => log.info('mail not sent: no provider', { to: `***@${String(to).split('@').pop()}`, subject }) };

const mailers = new Map([[logMailer.name, logMailer]]);
export const registerMailer = (mailer) => mailers.set(mailer.name, mailer);

const money = (n) => (typeof n === 'number' ? ` Total: £${n}.` : '');
const stay = (b, h) => `${h.name}, ${b.from} to ${b.to}.${money(b.total)}`;

// One message per event, for the guest and for the owners. Plain text only.
const TEMPLATES = {
	requested: (b, h) => ({ guest: [`We have your request for ${h.name}`, `Thanks ${b.guest}. We are holding ${stay(b, h)} until we confirm it. Reference ${b.id}.`], owner: [`New booking request: ${h.name}`, `${b.guest} (${b.email}) wants ${stay(b, h)}`] }),
	conflict: (b, h) => ({ owner: [`Double booking: ${h.name}`, b.note] }),
	paymentIssue: (b) => ({ owner: ['Payment needs attention', `Booking ${b.id}: ${b.note}`] }),
	confirmed: (b, h) => ({ guest: [`Booking confirmed: ${h.name}`, `Hello ${b.guest}, your stay is confirmed. ${stay(b, h)} Reference ${b.id}.`], owner: [`Booking confirmed: ${h.name}`, `${b.guest}, ${stay(b, h)}`] }),
	cancelled: (b, h) => ({ guest: [`Booking cancelled: ${h.name}`, `Hello ${b.guest}, your booking for ${stay(b, h)} was cancelled. Reference ${b.id}.`], owner: [`Booking cancelled: ${h.name}`, `${b.guest}, ${stay(b, h)}`] }),
};

export function createNotifier({ mailer = 'log', ownerEmail = '', homes = [] } = {}) {
	const m = mailers.get(mailer);
	if (!m) throw new Error(`Unknown MAIL_PROVIDER "${mailer}". Registered: ${[...mailers.keys()].join(', ')}`);
	// Email trouble must never lose or fail a booking, so errors are logged and swallowed.
	const safe = (msg) => Promise.resolve().then(() => m.send(msg)).catch((err) => log.error('mail failed', { err }));
	return async function notify(event, booking) {
		const h = (typeof homes === 'function' ? await homes() : homes).find((x) => x.slug === booking.home) || { name: booking.home };
		const t = TEMPLATES[event](booking, h);
		const jobs = [];
		if (booking.email && t.guest) jobs.push(safe({ to: booking.email, subject: t.guest[0], text: t.guest[1] }));
		if (ownerEmail) jobs.push(safe({ to: ownerEmail, subject: t.owner[0], text: t.owner[1] }));
		await Promise.all(jobs);
	};
}
