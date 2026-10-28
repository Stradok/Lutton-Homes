// Properties the owners manage. Stored in the data file; until the first change the list is the website's own homes.json.
// A record has the same shape as a homes.json entry, so the static site can be built from either.
import { HttpError } from './http.js';

export const CATEGORIES = ['homes', 'restaurants', 'misc'];
const TONES = ['sky', 'paper', 'ink']; // the colour families the pages know
const ROOM_TYPES = ['Bedroom', 'Kitchen', 'Bathroom', 'Living room', 'Outdoor space'];
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const list = (v, n, max) => (Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, n) : []);

// Photos are addresses (from POST /api/admin/uploads or any https address), never raw file data.
const photoUrl = (v) => { const s = text(v, 300); return /^(https:\/\/|\/media\/|\/api\/media\/)/.test(s) ? s : ''; };

// rooms: [{ type: 'Bedroom', photos: [{ day, night?, alt? }] }]. Turned into the images, alts and tour the pages use.
function fromRooms(rooms) {
	const tour = [], images = [], alts = [], nights = {};
	for (const r of Array.isArray(rooms) ? rooms.slice(0, 40) : []) {
		const type = ROOM_TYPES.includes(r?.type) ? r.type : text(r?.type, 40) || 'Room';
		const shots = (Array.isArray(r?.photos) ? r.photos : []).slice(0, 12).map((p) => ({ src: photoUrl(p?.day), night: photoUrl(p?.night), alt: text(p?.alt, 160) || type })).filter((p) => p.src);
		if (!shots.length) continue;
		tour.push({ title: type, images: shots.map((p) => ({ src: p.src, w: 1600, h: 1067 })) });
		for (const p of shots) { images.push(p.src); alts.push(p.alt); if (p.night) nights[p.src] = p.night; }
	}
	return { tour, images, alts, nights };
}

export function cleanHome(input, existing = {}) {
	const m = { ...existing, ...input };
	const name = text(m.name, 80);
	if (!name) throw new HttpError(400, 'Name is required');
	const rate = Number(m.rate), sleeps = Number(m.sleeps);
	if (!(rate >= 0 && rate <= 5000)) throw new HttpError(400, 'Rate must be a number from 0 to 5000');
	if (!Number.isInteger(sleeps) || sleeps < 1 || sleeps > 30) throw new HttpError(400, 'Sleeps must be 1 to 30');
	const category = CATEGORIES.includes(m.category) ? m.category : text(m.category, 40) || 'homes';
	const rooms = input.rooms !== undefined ? fromRooms(input.rooms) : null;
	const slug = existing.slug || slugOf(name);
	if (!slug) throw new HttpError(400, 'Name needs letters or numbers');
	return {
		slug, name, category,
		monogram: text(m.monogram, 3) || name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
		tone: TONES.includes(m.tone) ? m.tone : 'sky', tags: list(m.tags, 8, 40), sample: false,
		sleeps, rate, beds: text(m.beds, 60), distance: text(m.distance, 100), address: text(m.address, 200),
		summary: text(m.summary, 300), amenities: list(m.amenities, 30, 60), rules: list(m.rules, 20, 100),
		images: rooms ? rooms.images : existing.images || [], alts: rooms ? rooms.alts : existing.alts || [],
		tour: rooms ? rooms.tour : existing.tour || [], nightImages: rooms ? rooms.nights : existing.nightImages || {},
	};
}

export const listHomes = async (store, seed) => (await store.meta('homes')) ?? seed;

// Edit the list atomically. The first change copies the website's homes into the store so nothing is lost.
export async function changeHomes(store, seed, fn) {
	let result;
	await store.mutate('homes', (cur, blocks) => { const next = fn(cur ?? seed, blocks); result = next.result; return next.homes; });
	return result;
}
