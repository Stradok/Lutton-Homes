// Guest reviews. A guest can only write one if an owner sent them a review link (a signed, one-use token); every review
// waits for an owner to publish it. Stored in the data file under "reviews".
import { createHmac, randomBytes } from 'node:crypto';
import { HttpError, safeEqual } from './http.js';

// The 'review:' prefix keeps these signatures apart from owner sessions, which use the same secret.
const sign = (body, secret) => createHmac('sha256', secret).update('review:' + body).digest('base64url');

// The link token says which home (and optional booking reference) it is for, and carries a random id so it works once.
export function makeReviewToken({ home, ref = '' }, secret) {
	const body = Buffer.from(JSON.stringify({ h: home, r: ref, i: randomBytes(8).toString('hex') })).toString('base64url');
	return `${body}.${sign(body, secret)}`;
}

export function readReviewToken(token, secret) {
	const [body, sig] = String(token).split('.');
	if (!secret || !body || !sig || !safeEqual(sign(body, secret), sig)) return null;
	try { const { h, r, i } = JSON.parse(Buffer.from(body, 'base64url').toString()); return { home: h, ref: r, id: i }; } catch { return null; }
}

export function cleanReview(b) {
	const stars = Number(b.stars), body = String(b.text ?? '').trim().slice(0, 1000);
	if (![1, 3, 5].includes(stars)) throw new HttpError(400, 'Choose 1, 3 or 5 stars');
	if (!body) throw new HttpError(400, 'Write a few words about your stay');
	return { stars, text: body, name: String(b.name ?? '').trim().slice(0, 60) };
}

export const publicView = ({ id, home, stars, text, name, createdAt }) => ({ id, home, stars, text, name, createdAt });
