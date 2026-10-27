// Builds the static design site into dist/. No dependencies. Run with Node 22: node build.mjs
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const readHtmlDir = (dir) => (existsSync(dir) ? Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => [f.replace(/\.html$/, ''), readFileSync(join(dir, f), 'utf8')])) : {});
const basePartials = readHtmlDir(at('src/partials'));
if (!PREVIEW) basePartials['preview-strip'] = '';
// One pass: {{key}} is escaped, {{{key}}} is inserted as HTML, {{> name}} inserts a partial rendered the same way.
// replace() never rescans its output, so a substituted value that contains {{...}} stays literal.
const renderWith = (partials) => {
	const render = (tpl, vars) => tpl.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}|\{\{> ([\w-]+)\}\}/g,
		(_, raw, key, part) => (part ? render(need(partials, part), vars) : raw ? need(vars, raw) : esc(need(vars, key))));
	return render;
};

const WA = 'https://wa.me/447934586612';
const MAPS = 'https://www.google.com/maps/search/?api=1&query=34+Beaconsfield+Luton+LU2+0RW';
const rateHtml = (h) => `From £${h.rate} a night <span class="sample">(sample)</span>`;
// A gate sign is a photo slot. With a real image (home.images in data/homes.json) the image fills the panel;
// without one the monogram panel stays.
// Images are published as name-1600.webp with a name-800.webp twin for srcset.
// Open photos are buttons that the lightbox in app.js opens.
// A photo with an AI night version (name-night-1600.webp beside it) carries it in data-night so a design can swap it in.
const nightOf = (src) => { const n = src.replace('-1600.webp', '-night-1600.webp'); return n !== src && existsSync(at('public', n)) ? n : ''; };
const nightAttr = (src) => (nightOf(src) ? ` data-night="${esc(nightOf(src))}"` : '');
const gateSign = (h, tone, { named = false, src = '', eager = false, alt = '', sizes = '', open = false } = {}) => {
	const cls = `gate-sign gate-sign--${tone}`;
	const vt = named ? ` style="view-transition-name: home-${h.slug}"` : '';
	if (src) {
		const img = `<img src="${esc(src)}" srcset="${esc(src.replace('-1600.webp', '-800.webp'))} 800w, ${esc(src)} 1600w" sizes="${sizes}" alt="${esc(alt)}"${nightAttr(src)} width="1600" height="1067" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
		return open ? `<button type="button" class="${cls} gallery-open" data-open aria-haspopup="dialog"${vt}>${img}</button>` : `<div class="${cls}"${vt}>${img}</div>`;
	}
	return `<div class="${cls}"${vt}><span class="gate-sign-mark">${esc(h.monogram)}</span><span class="gate-sign-note">Photo coming soon</span></div>`;
};
// On /homes/ the card title is h2 (the page has one h1); on the home page the cards sit under an h2 and stay h3.
const distances = homes.map((h) => `<li><a class="link" href="/homes/${h.slug}/">${esc(h.name)}</a>: ${esc(h.distance)} <span class="sample">(sample)</span></li>`).join('');
const homeCard = (h, inList) => `<li class="reveal" data-tags="|${h.tags.map(esc).join('|')}|"><a class="home-card" href="/homes/${h.slug}/"${inList ? ` data-carry data-rate="${h.rate}"` : ''}>`
	+ gateSign(h, h.tone, { named: true, src: h.images?.[0], alt: h.alts?.[0], sizes: '(min-width: 768px) 36rem, 100vw' })
	+ `<div class="home-card-body"><${inList ? 'h2' : 'h3'}>${esc(h.name)}</${inList ? 'h2' : 'h3'}><p class="by-line">by Luton Homes</p><p class="facts-line">${esc(h.beds)}, ${esc(h.distance)}</p><p class="rate">${rateHtml(h)}</p>`
	+ (inList ? '<p class="estimate" data-est hidden></p>' : '')
	+ '</div></a></li>';
// Departures design: the five homes as rows on an arrivals board.
const boardRow = (h) => `<li><a class="board-row" href="/homes/${h.slug}/"><span class="board-home" data-flap>${esc(h.name)}</span><span class="board-gate">${esc(h.monogram)}</span><span class="board-info">${esc(h.beds)}</span><span class="board-rate">From £${h.rate} <span class="sample">(sample)</span></span></a></li>`;
// Cinematic design: one dark window per home for the lights-on hold.
const windowTile = (h) => `<li><a class="cin-window" href="/homes/${h.slug}/"><span class="cin-window-mark" aria-hidden="true">${esc(h.monogram)}</span><span class="cin-window-name">${esc(h.name)}</span></a></li>`;
const listItems = (items) => items.map((x) => `<li>${esc(x)}</li>`).join('');
const otherHomes = (h) => homes.filter((o) => o.slug !== h.slug).map((o) => `<li><a class="other-home" href="/homes/${o.slug}/" data-carry><span class="other-home-name">${esc(o.name)}</span><span class="rate">${rateHtml(o)}</span></a></li>`).join('');
const galleryFor = (h) => {
	const start = TONES.indexOf(h.tone);
	const sizes = (k) => (k === 0 ? '(min-width: 1140px) 1104px, 100vw' : '(min-width: 1140px) 540px, 50vw');
	return [0, 1, 2, 3, 4].filter((k) => k < 3 || h.images?.[k]).map((k) => gateSign(h, TONES[(start + k) % 3], { named: k === 0, eager: k === 0, src: h.images?.[k], alt: h.alts?.[k], sizes: sizes(k), open: true })).join('');
};
// Room-by-room photo tour (home.tour in data/homes.json): tiles on the page and a scrollable dialog, like a listing photo tour.
const roomId = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const small = (src) => src.replace('-1600.webp', '-800.webp');
const tourTiles = (h) => (h.tour ? `<section id="tour" class="c3-tiles"><h2>Photo tour</h2><ul class="c3-rooms">${h.tour.map((r) => `<li><button type="button" class="c3-room" data-tour-open="${roomId(r.title)}"><img src="${esc(small(r.images[0].src))}" alt="${esc(r.title)} photo"${nightAttr(r.images[0].src)} width="${r.images[0].w}" height="${r.images[0].h}" loading="lazy" decoding="async"><span class="c3-room-name">${esc(r.title)}</span><span class="c3-room-count">${r.images.length} ${r.images.length === 1 ? 'photo' : 'photos'}</span></button></li>`).join('')}</ul></section>` : '');
const showAll = (h) => (h.tour ? '<button type="button" class="c3-show-all" data-tour-open="">Show all photos</button>' : '');
const tourDialog = (h) => (h.tour ? `<dialog id="tour-dialog" class="c3-tour-dialog" aria-label="${esc(h.name)} photo tour"><div class="c3-tour-bar"><button type="button" class="c3-tour-close" data-tour-close>Close</button><nav aria-label="Rooms"><ul>${h.tour.map((r) => `<li><a href="#tour-${roomId(r.title)}" data-room="${roomId(r.title)}">${esc(r.title)}</a></li>`).join('')}</ul></nav></div><div class="c3-tour-body">${h.tour.map((r) => `<section id="tour-${roomId(r.title)}"><h2>${esc(r.title)}</h2><div class="c3-tour-imgs">${r.images.map((im, k) => `<img src="${esc(im.src)}" srcset="${esc(small(im.src))} 800w, ${esc(im.src)} 1600w" sizes="(min-width: 900px) 440px, 100vw" alt="${esc(r.title)}, photo ${k + 1} of ${r.images.length} (sample image)"${nightAttr(im.src)} width="${im.w}" height="${im.h}" loading="lazy" decoding="async">`).join('')}</div></section>`).join('')}</div></dialog>` : '');
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

// Designs, in menu order. Each one is a full site built from the base templates in src/pages and src/partials,
// with its own overrides in src/designs/<id>/{pages,partials} and its own stylesheet src/designs/<id>/design.css.
// Original lives at the site root, the others under /d/<id>/. `attr` is the html data-design value the CSS keys on.
const DESIGNS = [
	{ id: 'original', name: 'Original', base: '', attr: 'original' },
	{ id: 'sky', name: 'Sky', base: '/d/sky', attr: 'dawn' },
	{ id: 'departures', name: 'Departures', base: '/d/departures', attr: 'departures' },
	{ id: 'orbit', name: 'Orbit', base: '/d/orbit', attr: 'orbit' },
	{ id: 'custom-1', name: 'Custom 1', base: '/d/custom-1', attr: 'custom-1' },
	{ id: 'custom-2', name: 'Custom 2', base: '/d/custom-2', attr: 'custom-2' },
	{ id: 'client-original', name: 'Client Original', base: '/d/client-original', attr: 'client-original' },
	{ id: 'client-original2', name: 'Client Original 2', base: '/d/client-original2', attr: 'client-original2' },
	{ id: 'cinematic', name: 'Cinematic', base: '/d/cinematic', attr: 'cinematic' },
];
// The switcher lists every design as a plain link to the same page in that design, so it works without JavaScript.
const switcherFor = (design, path) => '<div class="design-switcher" role="group" aria-label="Design preview switcher" data-switcher>'
	+ '<button type="button" class="design-switcher-button" aria-haspopup="menu" aria-expanded="false" aria-controls="design-menu">'
	+ `<span class="design-switcher-glyph" aria-hidden="true"></span><span class="design-switcher-text">Design: ${esc(design.name)}</span><span class="design-switcher-chev" aria-hidden="true"></span></button>`
	+ '<div class="design-switcher-menu" id="design-menu" role="menu" hidden>'
	+ DESIGNS.map((d) => `<a role="menuitemradio" aria-checked="${d === design}" data-design-value="${d.id}" href="${d.base}${path}">${esc(d.name)}</a>`).join('')
	+ '</div></div><script src="/assets/switcher.js" defer></script>';
const PREVIEW_HEAD = PREVIEW ? '<link rel="stylesheet" href="/assets/switcher.css">' : '';
// Old links used ?design=<id> on the root site; send them to that design's address.
const LEGACY = Object.fromEntries([...DESIGNS.map((d) => [d.id, d.base]), ['dawn', '/d/sky']].filter(([, b]) => b));
const LEGACY_SCRIPT = `<script>(function(){var m=${JSON.stringify(LEGACY)};try{var q=new URLSearchParams(location.search),v=q.get("design");if(m[v]){q.delete("design");location.replace(m[v]+location.pathname+(q.size?"?"+q:""))}}catch(e){}})();</script>`;
// The Sky design plays the night-to-dawn intro once per browser session (the switcher clears the flag so a chosen design replays it).
const DAWN_SCRIPT = '<script>(function(){var d=document.documentElement,seen=null;try{seen=sessionStorage.getItem("lh-dawn-seen")}catch(e){}d.classList.add(seen||matchMedia("(prefers-reduced-motion: reduce)").matches?"dawn-go":"dawn-pending")})();</script>';
// Custom 1 plays its cloud-and-plane intro on the home page once per browser session; the class is set before first paint.
const C1_SCRIPT = '<script>(function(){var d=document.documentElement,seen=null;try{seen=sessionStorage.getItem("lh-c1-seen")}catch(e){}if(!seen&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&/^\\/d\\/custom-1\\/?$/.test(location.pathname))d.classList.add("c1-pending")})();</script>';
// Custom 2 plays its own cloud-and-plane intro on the home page once per browser session.
const C2_SCRIPT = '<script>(function(){var d=document.documentElement,seen=null;try{seen=sessionStorage.getItem("lh-c2-seen")}catch(e){}if(!seen&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&/^\\/d\\/custom-2\\/?$/.test(location.pathname))d.classList.add("c2-pending")})();</script>';
// Client Original plays the same plane-and-clouds intro as Custom 1 before its white landing page.
const C3_SCRIPT = C1_SCRIPT.replace(/c1|custom-1/g, (m) => (m === 'c1' ? 'c3' : 'client-original'));
// Client Original 2 keeps the earlier gradient-cloud intro; its own session key so both intros can play.
const C3B_SCRIPT = C3_SCRIPT.replace('client-original', 'client-original2').replace('lh-c3-seen', 'lh-c3b-seen');
// Client Original picks day or night from the visitor's local time (night 19:00 to 07:00) unless they chose; set before first paint.
const THEME_SCRIPT = '<script>(function(){var d=document.documentElement,t=null;try{t=localStorage.getItem("lh-theme")}catch(e){}if(t!=="day"&&t!=="night"){var h=new Date().getHours();t=h>=19||h<7?"night":"day"}d.setAttribute("data-theme",t)})();</script>';
const designHead = (d) => [
	d.id === 'original' ? '<link rel="stylesheet" href="/assets/theme-original.css">' : '',
	existsSync(at('src/designs', d.id, 'design.css')) ? `<link rel="stylesheet" href="/assets/design-${d.id}.css">` : '',
	d.id === 'original' && PREVIEW ? LEGACY_SCRIPT : '',
	d.attr === 'dawn' ? DAWN_SCRIPT : '',
	d.id === 'custom-1' ? C1_SCRIPT : '',
	d.id === 'custom-2' ? C2_SCRIPT : '',
	d.id === 'client-original' ? C3_SCRIPT + '\n' + THEME_SCRIPT : '',
	d.id === 'client-original2' ? C3B_SCRIPT : '',
].filter(Boolean).join('\n');
// Root-relative site links in a design's pages are moved under its base; shared files (/assets, /fonts, /media, /favicon) are not.
const withBase = (html, base) => (base ? html.replace(/(\s(?:href|action)=")\/(?!assets\/|fonts\/|media\/|favicon|d\/)/g, `$1${base}/`) : html);
const VARIANT_HEAD = '<link rel="stylesheet" href="/assets/variants.css">\n<script src="/assets/variants.js" defer></script>';
// schema.org lodging data from the facts already on the page: no ratings, prices or amenity claims.
const schemaFor = (h) => '<script type="application/ld+json">' + JSON.stringify({
	'@context': 'https://schema.org', '@type': 'LodgingBusiness', name: `${h.name} by Luton Homes`, description: h.summary,
	address: { '@type': 'PostalAddress', streetAddress: '34 Beaconsfield', addressLocality: 'Luton', postalCode: 'LU2 0RW', addressCountry: 'GB' },
}).replace(/</g, '\\u003c') + '</script>';
const shared = { year: new Date().getFullYear(), wa: WA, maps: MAPS, homesJson, extraHead: PREVIEW_HEAD };
const pages = [
	{
		file: 'index.html', out: 'index.html',
		title: 'Luton Homes: homes near Luton Airport, booked direct',
		description: CANONICAL,
		vars: { homeCards: homes.map((h) => homeCard(h, false)).join(''), boardRows: homes.map(boardRow).join(''), windowTiles: homes.map(windowTile).join(''), extraHead: PREVIEW ? PREVIEW_HEAD + '\n' + VARIANT_HEAD : '' },
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
			slug: h.slug, name: h.name, monogram: h.monogram, summary: h.summary, rate: h.rate, sleeps: h.sleeps, beds: h.beds, distance: h.distance,
			ask: encodeURIComponent(`Hello Luton Homes, I am interested in ${h.name}.`),
			gallery: galleryFor(h), lightbox: lightbox(h), tourTiles: tourTiles(h), showAll: showAll(h), tourDialog: tourDialog(h),
			galleryCaption: h.images?.length ? '<p class="gallery-caption">Sample image</p>' : '',
			amenities: listItems(h.amenities), rules: listItems(h.rules), otherHomes: otherHomes(h),
			extraHead: PREVIEW_HEAD + schemaFor(h),
		},
	})),
	{ file: 'book.html', out: 'book/index.html', title: 'Book your stay | Luton Homes', description: 'Book a Luton Homes stay in three steps. This design preview makes no booking.', vars: {} },
	{ file: 'book-confirmed.html', out: 'book/confirmed/index.html', title: 'Booking confirmed (preview) | Luton Homes', description: 'Preview confirmation for a Luton Homes stay. No booking is made.', vars: {} },
	{ file: 'about.html', out: 'about/index.html', title: 'About | Luton Homes', description: 'Luton Homes runs five short-stay homes near Luton Airport, with one team behind them.', vars: {} },
	{ file: 'contact.html', out: 'contact/index.html', title: 'Contact | Luton Homes', description: 'Message Luton Homes on WhatsApp or visit us at 34 Beaconsfield, Luton LU2 0RW.', vars: {} },
	{ file: 'local-area.html', out: 'local-area/index.html', title: 'Getting here | Luton Homes', description: 'Where Luton Homes is, and how far each home is from Luton Airport.', vars: { distances } },
	{ file: 'terms.html', out: 'terms/index.html', title: 'Terms and booking conditions | Luton Homes', description: 'Draft terms for booking a Luton Homes stay direct.', vars: {} },
	{ file: 'cancellation.html', out: 'cancellation/index.html', title: 'Cancellation policy | Luton Homes', description: 'Draft cancellation policy placeholder for Luton Homes.', vars: {} },
	{ file: 'privacy.html', out: 'privacy/index.html', title: 'Privacy policy | Luton Homes', description: 'Draft privacy policy for Luton Homes.', vars: {} },
	{ file: 'cookies.html', out: 'cookies/index.html', title: 'Cookie policy | Luton Homes', description: 'What the Luton Homes site stores in your browser.', vars: {} },
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
let built = 0;
for (const d of DESIGNS) {
	const dir = at('src/designs', d.id);
	if (existsSync(join(dir, 'design.css'))) cpSync(join(dir, 'design.css'), join(dist, 'assets', `design-${d.id}.css`));
	if (existsSync(join(dir, 'design.js'))) cpSync(join(dir, 'design.js'), join(dist, 'assets', `design-${d.id}.js`));
	const render = renderWith({ ...basePartials, ...readHtmlDir(join(dir, 'partials')) });
	const designVars = { design: d.attr, designId: d.id, designHead: designHead(d), base: d.base, designJs: existsSync(join(dir, 'design.js')) ? `<script src="/assets/design-${d.id}.js" defer></script>` : '' };
	for (const p of pages) {
		// Error pages exist once, at the root: the host serves /404.html for every missing path.
		if (d.base && /^(404|500)\.html$/.test(p.out)) continue;
		const own = join(dir, 'pages', p.file);
		const vars = { ...shared, ...designVars, title: p.title, description: p.description, ...p.vars };
		const out = join(dist, d.base, p.out);
		mkdirSync(dirname(out), { recursive: true });
		let html = withBase(render(readFileSync(existsSync(own) ? own : at('src/pages', p.file), 'utf8'), vars), d.base);
		const path = '/' + p.out.replace(/index\.html$/, '');
		if (PREVIEW && !/^(404|500)\.html$/.test(p.out)) html = html.replace('</body>', switcherFor(d, path) + '</body>');
		writeFileSync(out, html);
		built++;
	}
}
console.log(`built ${built} pages (${DESIGNS.length} designs) into dist/`);
