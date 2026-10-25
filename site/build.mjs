// Builds the static design site into dist/. No dependencies. Run with Node 22: node build.mjs
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const at = (...p) => join(root, ...p);
const dist = at('dist');
const { homes } = JSON.parse(readFileSync(at('data/homes.json'), 'utf8'));
const TONES = ['sky', 'paper', 'ink'];
// Design preview: the preview strip, the design switcher and the variant files. Set to false for launch.
const PREVIEW = true;
const CANONICAL = 'Short-stay homes near Luton Airport. Five properties, one team. Book direct with Luton Homes.';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const need = (map, key) => {
	if (!(key in map)) throw new Error('missing template value: ' + key);
	return map[key];
};
const partials = Object.fromEntries(readdirSync(at('src/partials')).map((f) => [f.replace(/\.html$/, ''), readFileSync(at('src/partials', f), 'utf8')]));
if (!PREVIEW) partials['preview-strip'] = '';
// One pass: {{key}} is escaped, {{{key}}} is inserted as HTML, {{> name}} inserts a partial rendered the same way.
// replace() never rescans its output, so a substituted value that contains {{...}} stays literal.
const render = (tpl, vars) => tpl.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}|\{\{> ([\w-]+)\}\}/g,
	(_, raw, key, part) => (part ? render(need(partials, part), vars) : raw ? need(vars, raw) : esc(need(vars, key))));

const WA = 'https://wa.me/447934586612';
const MAPS = 'https://www.google.com/maps/search/?api=1&query=34+Beaconsfield+Luton+LU2+0RW';
const rateHtml = (h) => `From £${h.rate} a night <span class="sample">(sample)</span>`;
// A gate sign is a photo slot. With a real image (home.images in data/homes.json) the image fills the panel;
// without one the monogram panel stays.
// Images are published as name-1600.webp with a name-800.webp twin for srcset.
// Open photos are buttons that the lightbox in app.js opens.
const gateSign = (h, tone, { named = false, src = '', eager = false, alt = '', sizes = '', open = false } = {}) => {
	const cls = `gate-sign gate-sign--${tone}`;
	const vt = named ? ` style="view-transition-name: home-${h.slug}"` : '';
	if (src) {
		const img = `<img src="${esc(src)}" srcset="${esc(src.replace('-1600.webp', '-800.webp'))} 800w, ${esc(src)} 1600w" sizes="${sizes}" alt="${esc(alt)}" width="1600" height="1067" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
		return open ? `<button type="button" class="${cls} gallery-open" data-open aria-haspopup="dialog"${vt}>${img}</button>` : `<div class="${cls}"${vt}>${img}</div>`;
	}
	return `<div class="${cls}"${vt}><span class="gate-sign-mark">${esc(h.monogram)}</span><span class="gate-sign-note">Photo coming soon</span></div>`;
};
// On /homes/ the card title is h2 (the page has one h1); on the home page the cards sit under an h2 and stay h3.
const homeCard = (h, inList) => `<li class="reveal" data-tags="|${h.tags.map(esc).join('|')}|"><a class="home-card" href="/homes/${h.slug}/"${inList ? ` data-carry data-rate="${h.rate}"` : ''}>`
	+ gateSign(h, h.tone, { named: true, src: h.images?.[0], alt: h.alts?.[0], sizes: '(min-width: 768px) 36rem, 100vw' })
	+ `<div class="home-card-body"><${inList ? 'h2' : 'h3'}>${esc(h.name)}</${inList ? 'h2' : 'h3'}><p class="by-line">by Luton Homes</p><p class="facts-line">${esc(h.beds)}, ${esc(h.distance)}</p><p class="rate">${rateHtml(h)}</p>`
	+ (inList ? '<p class="estimate" data-est hidden></p>' : '')
	+ '</div></a></li>';
const listItems = (items) => items.map((x) => `<li>${esc(x)}</li>`).join('');
const otherHomes = (h) => homes.filter((o) => o.slug !== h.slug).map((o) => `<li><a class="other-home" href="/homes/${o.slug}/" data-carry><span class="other-home-name">${esc(o.name)}</span><span class="rate">${rateHtml(o)}</span></a></li>`).join('');
const galleryFor = (h) => {
	const start = TONES.indexOf(h.tone);
	const sizes = (k) => (k === 0 ? '(min-width: 1140px) 1104px, 100vw' : '(min-width: 1140px) 540px, 50vw');
	return [0, 1, 2].map((k) => gateSign(h, TONES[(start + k) % 3], { named: k === 0, eager: k === 0, src: h.images?.[k], alt: h.alts?.[k], sizes: sizes(k), open: true })).join('');
};
// Lightbox dialog for a home with photos. app.js fills in the image, caption and count.
const lightbox = (h) => (h.images?.length ? `<dialog id="lightbox" class="lightbox" aria-label="${esc(h.name)} photos">`
	+ `<figure class="lightbox-figure"><img id="lightbox-img" src="${esc(h.images[0])}" alt="${esc(h.alts[0])}" width="1600" height="1067"><figcaption id="lightbox-caption"></figcaption></figure>`
	+ '<p class="lightbox-count" id="lightbox-count" aria-live="polite"></p>'
	+ '<button type="button" class="lightbox-btn lightbox-close" data-lb="close">Close</button>'
	+ '<button type="button" class="lightbox-btn lightbox-prev" data-lb="prev" aria-label="Previous photo"><span class="chev" aria-hidden="true"></span></button>'
	+ '<button type="button" class="lightbox-btn lightbox-next" data-lb="next" aria-label="Next photo"><span class="chev" aria-hidden="true"></span></button>'
	+ '</dialog>' : '');
// The booking pages read name and rate by slug from this inline JSON (no request).
const homesJson = `<script id="lh-homes" type="application/json">${JSON.stringify(Object.fromEntries(homes.map((h) => [h.slug, { name: h.name, rate: h.rate }]))).replace(/</g, '\\u003c')}</script>`;

// Preview only: the switcher markup (four designs, in menu order) and the design script that reads ?design= then localStorage before first paint.
// Default is original; unknown values fall back to original. The html tag also carries data-design="original" for no-JS pages.
const SWITCHER = '<div class="design-switcher" role="group" aria-label="Design preview switcher" data-switcher>'
	+ '<button type="button" class="design-switcher-button" aria-haspopup="menu" aria-expanded="false" aria-controls="design-menu">'
	+ '<span class="design-switcher-glyph" aria-hidden="true"></span><span class="design-switcher-text">Design: Original</span><span class="design-switcher-chev" aria-hidden="true"></span></button>'
	+ '<div class="design-switcher-menu" id="design-menu" role="menu" hidden>'
	+ '<button type="button" role="menuitemradio" aria-checked="true" data-design-value="original">Original</button>'
	+ '<button type="button" role="menuitemradio" aria-checked="false" data-design-value="sky">Sky</button>'
	+ '<button type="button" role="menuitemradio" aria-checked="false" data-design-value="dawn">Night to dawn</button>'
	+ '<button type="button" role="menuitemradio" aria-checked="false" data-design-value="orbit">Orbit</button>'
	+ '</div></div><script src="/assets/switcher.js" defer></script>';
const PREVIEW_HEAD = PREVIEW ? '<link rel="stylesheet" href="/assets/switcher.css">' : '';
const DESIGN_SCRIPT = '<script>(function(){var d=document.documentElement,v="original",u=null,s=null;try{u=new URLSearchParams(location.search).get("design");s=localStorage.getItem("lh-design")}catch(e){}if(/^(original|sky|dawn|orbit)$/.test(u))v=u;else if(/^(original|sky|dawn|orbit)$/.test(s))v=s;d.dataset.design=v;if(v!=="dawn")return;var seen=null;try{seen=sessionStorage.getItem("lh-dawn-seen")}catch(e){}if(seen||matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("dawn-go");else d.classList.add("dawn-pending")})();</script>';
const VARIANT_HEAD = '<link rel="stylesheet" href="/assets/variants.css">\n<script src="/assets/variants.js" defer></script>';
const shared = { year: new Date().getFullYear(), wa: WA, maps: MAPS, homesJson, designScript: PREVIEW ? DESIGN_SCRIPT : '', extraHead: PREVIEW_HEAD };
const pages = [
	{
		file: 'index.html', out: 'index.html',
		title: 'Luton Homes: homes near Luton Airport, booked direct',
		description: CANONICAL,
		vars: { homeCards: homes.map((h) => homeCard(h, false)).join(''), extraHead: PREVIEW ? PREVIEW_HEAD + '\n' + VARIANT_HEAD : '' },
	},
	{
		file: 'homes.html', out: 'homes/index.html',
		title: 'Our homes | Luton Homes',
		description: 'Five short-stay homes near Luton Airport. Each has its own name, sample rates and details.',
		vars: { homeCards: homes.map((h) => homeCard(h, true)).join(''), count: `${homes.length} homes` },
	},
	...homes.map((h) => ({
		file: 'home-template.html', out: `homes/${h.slug}/index.html`,
		title: `${h.name} | Luton Homes`,
		description: `${h.summary} Book direct with Luton Homes.`,
		vars: {
			slug: h.slug, name: h.name, summary: h.summary, rate: h.rate, sleeps: h.sleeps, beds: h.beds, distance: h.distance,
			ask: encodeURIComponent(`Hello Luton Homes, I am interested in ${h.name}.`),
			gallery: galleryFor(h), lightbox: lightbox(h),
			galleryCaption: h.images?.length ? '<p class="gallery-caption">Sample image</p>' : '',
			amenities: listItems(h.amenities), rules: listItems(h.rules), otherHomes: otherHomes(h),
		},
	})),
	{ file: 'book.html', out: 'book/index.html', title: 'Book your stay | Luton Homes', description: 'Book a Luton Homes stay in three steps. This design preview makes no booking.', vars: {} },
	{ file: 'book-confirmed.html', out: 'book/confirmed/index.html', title: 'Booking confirmed (preview) | Luton Homes', description: 'Preview confirmation for a Luton Homes stay. No booking is made.', vars: {} },
	{ file: 'about.html', out: 'about/index.html', title: 'About | Luton Homes', description: 'Luton Homes runs five short-stay homes near Luton Airport, with one team behind them.', vars: {} },
	{ file: 'contact.html', out: 'contact/index.html', title: 'Contact | Luton Homes', description: 'Message Luton Homes on WhatsApp or visit us at 34 Beaconsfield, Luton LU2 0RW.', vars: {} },
	{ file: 'faq.html', out: 'faq/index.html', title: 'FAQ | Luton Homes', description: 'Short answers about booking a Luton Homes stay direct.', vars: {} },
	{ file: '404.html', out: '404.html', title: 'Page not found | Luton Homes', description: 'This page is not here. Find a home or message us on WhatsApp.', vars: {} },
	{ file: '500.html', out: '500.html', title: 'Something went wrong | Luton Homes', description: 'Our site is having a problem right now. We are working on it. Go back to the home page.', vars: {} },
];

rmSync(dist, { recursive: true, force: true });
cpSync(at('public'), dist, { recursive: true });
mkdirSync(join(dist, 'assets'), { recursive: true });
cpSync(at('src/styles.css'), join(dist, 'assets/styles.css'));
cpSync(at('src/app.js'), join(dist, 'assets/app.js'));
cpSync(at('src/book.js'), join(dist, 'assets/book.js'));
cpSync(at('src/homes.js'), join(dist, 'assets/homes.js'));
for (const f of ['switcher.js', 'switcher.css', 'variants.js', 'variants.css', 'theme-original.css']) cpSync(at('src/' + f), join(dist, 'assets', f));
for (const p of pages) {
	const vars = { ...shared, title: p.title, description: p.description, ...p.vars };
	const out = join(dist, p.out);
	mkdirSync(dirname(out), { recursive: true });
	let html = render(readFileSync(at('src/pages', p.file), 'utf8'), vars);
	if (PREVIEW) html = html.replace('</body>', SWITCHER + '</body>');
	writeFileSync(out, html);
}
console.log(`built ${pages.length} pages into dist/`);
