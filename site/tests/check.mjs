// Static checks for dist/ and unit checks for the helpers in src/app.js. Run after build: node tests/check.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const failures = [];
const fail = (msg) => failures.push(msg);

// Routes whose files are not built yet. Empty: every internal link is checked.
const PENDING_ROUTES = [];
const ALLOWED_EXTERNAL = /^https:\/\/(wa\.me\/|www\.google\.com\/maps\/)/;
const KB = 1024;
const BUDGET = { html: 18 * KB, css: 38 * KB, js: 9 * KB, book: 4 * KB, homes: 4 * KB, media: 80 * KB, variantsCss: 14 * KB, variantsJs: 6 * KB, switcherJs: 3 * KB, switcherCss: 4 * KB, themeOriginalCss: 12 * KB };
// Designs come from build.mjs (id, menu name, base path, html data-design value), in menu order.
const DESIGN_LIST = [...readFileSync(join(root, 'build.mjs'), 'utf8').matchAll(/\{ id: '([\w-]+)', name: '([^']+)', base: '([^']*)', attr: '([\w-]+)' \}/g)].map(([, id, name, base, attr]) => ({ id, name, base, attr }));
const designOf = (page) => DESIGN_LIST.find((d) => d.base && page.startsWith(d.base.slice(1) + '/')) || DESIGN_LIST[0];
const HOMES = ['easystay', 'easystay-studio', 'luton-lodge', 'the-garden-nest', 'the-garden-studio'];
const CANONICAL = 'Short-stay homes near Luton Airport. Five properties, one team. Book direct with Luton Homes.';
const PREVIEW = 'Design preview: sample photos, prices and details.';
// The preview flag lives in build.mjs: when it is on, every page has the strip and the switcher.
const PREVIEW_ON = /^const PREVIEW = true;$/m.test(readFileSync(join(root, 'build.mjs'), 'utf8'));
const PAGES = ['index.html', 'homes/index.html', 'book/index.html', 'book/confirmed/index.html', 'about/index.html', 'contact/index.html', 'faq/index.html', '404.html'];

if (!existsSync(dist)) {
	console.error('dist/ is missing. Run node build.mjs first.');
	process.exit(1);
}

const files = readdirSync(dist, { recursive: true }).map(String).filter((f) => statSync(join(dist, f)).isFile());
const read = (f) => readFileSync(join(dist, f), 'utf8');
const variantsCss = read('assets/variants.css');
const themeCss = read('assets/theme-original.css');
const switcherCss = read('assets/switcher.css');
const pages = files.filter((f) => f.endsWith('.html') && !f.startsWith('requirements/')); // the checklist is a standalone tool page
const idsIn = (f) => new Set([...read(f).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

for (const page of pages) {
	const html = read(page);
	const name = relative(dist, join(dist, page));
	if (!/<title>[^<]+<\/title>/.test(html)) fail(`${name}: missing <title>`);
	if (!/<meta name="description" content="[^"]+">/.test(html)) fail(`${name}: missing meta description`);
	if (!html.includes('<meta name="robots" content="noindex">')) fail(`${name}: missing noindex`);
	if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail(`${name}: must have exactly one <h1>`);
	if (!html.includes('<main id="content"')) fail(`${name}: missing main#content`);
	if (PREVIEW_ON !== html.includes(PREVIEW)) fail(`${name}: preview strip ${PREVIEW_ON ? 'missing' : 'must not be built'}`);
	// Error pages are the same for every design, so they carry no switcher.
	if ((PREVIEW_ON && !/^(404|500)\.html$/.test(page)) !== html.includes('data-switcher')) fail(`${name}: design switcher ${PREVIEW_ON ? 'missing' : 'must not be built'}`);
	const design = designOf(page);
	const local = design.base ? page.slice(design.base.length) : page;
	if (!html.includes(`<html lang="en-GB" data-design="${design.attr}">`)) fail(`${name}: <html> must carry data-design="${design.attr}"`);
	if ((design.id === 'original') !== html.includes('/assets/theme-original.css')) fail(`${name}: theme-original.css belongs to the Original design only`);
	if (PREVIEW_ON && !/^(404|500)\.html$/.test(page)) {
		const options = [...html.matchAll(/<a role="menuitemradio" aria-checked="(true|false)" data-design-value="([^"]+)" href="([^"]+)">([^<]+)</g)];
		if (options.map((m) => m[2]).join() !== DESIGN_LIST.map((d) => d.id).join()) fail(`${name}: switcher options must be ${DESIGN_LIST.map((d) => d.id).join(', ')} in that order`);
		if (options.map((m) => m[4]).join() !== DESIGN_LIST.map((d) => d.name).join()) fail(`${name}: switcher labels must be ${DESIGN_LIST.map((d) => d.name).join(', ')}`);
		const path = '/' + local.replace(/index\.html$/, '');
		for (const [, checked, id, href] of options) {
			const d = DESIGN_LIST.find((x) => x.id === id);
			if (d && href !== d.base + path) fail(`${name}: switcher link for ${id} must be ${d.base + path}, got ${href}`);
			if ((checked === 'true') !== (id === design.id)) fail(`${name}: switcher must mark ${design.id} as current`);
		}
		if (!html.includes(`<span class="design-switcher-text">Design: ${design.name}</span>`)) fail(`${name}: switcher label must be Design: ${design.name}`);
		if (!html.includes('aria-label="Design preview switcher"')) fail(`${name}: switcher not announced as Design preview switcher`);
		if (!html.includes('/assets/switcher.css')) fail(`${name}: switcher.css not linked`);
	}
	if (/\/assets\/variants\.(css|js)/.test(html) && local !== 'index.html') fail(`${name}: variant files are for the home page only`);
	// Site links stay inside the page's own design (shared files and the switcher excepted).
	for (const [, value] of html.replace(/<div class="design-switcher"[\s\S]*?<\/div><\/div>/, '').matchAll(/\s(?:href|action)="(\/[^"]*)"/g)) {
		if (/^\/(assets|fonts|media|favicon)/.test(value)) continue;
		if (design.base ? !value.startsWith(design.base + '/') : value.startsWith('/d/')) fail(`${name}: link ${value} leaves the ${design.name} design`);
	}
	if (!html.includes('<link rel="icon" href="/favicon.svg"')) fail(`${name}: favicon not linked`);
	for (const [img] of html.matchAll(/<img\b[^>]*>/g)) {
		if (!/\swidth=/.test(img) || !/\sheight=/.test(img)) fail(`${name}: <img> without width and height`);
		if (!/\salt="[^"]+"/.test(img)) fail(`${name}: <img> without alt text`);
		for (const [, url] of (img.match(/\ssrcset="([^"]*)"/) || [, ''])[1].matchAll(/(\S+)\s+\d+w/g)) {
			if (!existsSync(join(dist, url))) fail(`${name}: srcset "${url}" does not exist`);
		}
	}
	for (const [, attr, value] of html.matchAll(/\s(href|src|action)="([^"]*)"/g)) {
		if (/^https?:\/\//.test(value)) {
			if (attr !== 'href' || !ALLOWED_EXTERNAL.test(value)) fail(`${name}: external ${attr} ${value}`);
			continue;
		}
		if (/^(mailto:|tel:|data:)/.test(value)) continue;
		const [path, hash] = value.split('#');
		const route = path.split('?')[0] || '/' + page.replace(/index\.html$/, '');
		if (PENDING_ROUTES.includes(route)) continue;
		let target = route === '/' || route.endsWith('/') ? join(route, 'index.html') : route;
		if (!path && !value.startsWith('?')) target = page;
		if (!existsSync(join(dist, target))) {
			fail(`${name}: ${attr} "${value}" does not resolve`);
			continue;
		}
		if (hash && !idsIn(relative(dist, join(dist, target))).has(hash)) fail(`${name}: no id "${hash}" in ${target}`);
	}
	const size = Buffer.byteLength(html);
	if (size > BUDGET.html) fail(`${name}: ${size} bytes, budget ${BUDGET.html}`);
}

const assets = { 'assets/styles.css': BUDGET.css, 'assets/app.js': BUDGET.js, 'assets/book.js': BUDGET.book, 'assets/homes.js': BUDGET.homes, 'assets/variants.css': BUDGET.variantsCss, 'assets/variants.js': BUDGET.variantsJs, 'assets/switcher.js': BUDGET.switcherJs, 'assets/switcher.css': BUDGET.switcherCss, 'assets/theme-original.css': BUDGET.themeOriginalCss };
for (const [file, budget] of Object.entries(assets)) {
	const text = read(file);
	if (Buffer.byteLength(text) > budget) fail(`${file}: ${Buffer.byteLength(text)} bytes, budget ${budget}`);
}

for (const file of files.filter((f) => f.startsWith('media/'))) {
	const size = statSync(join(dist, file)).size;
	// The Cinematic scrub video is the one large file (the 10k-websites target is 4 to 8 MB for a short 1080p clip);
	// its poster and stills get a still-image budget.
	const budget = file === 'media/cinematic/hero-scrub.mp4' ? 8 * 1024 * KB
		: file.startsWith('media/cinematic/') ? 120 * KB
		: file === 'media/earth-night-se-england.webp' ? 100 * KB : BUDGET.media;
	if (size > budget) fail(`${file}: ${size} bytes, budget ${budget}`);
}

for (const file of files.filter((f) => /\.(html|css|js)$/.test(f))) {
	const text = read(file);
	if (/[\u2013\u2014]|&ndash;|&mdash;/.test(text)) fail(`${file}: contains an en or em dash`);
}

if (DESIGN_LIST.length < 2 || DESIGN_LIST[0].id !== 'original' || DESIGN_LIST[0].base !== '') fail('build.mjs: Original must be the first design, at the site root');
for (const d of DESIGN_LIST) for (const page of PAGES) {
	if (d.base && /^404\.html$/.test(page)) continue;
	if (!existsSync(join(dist, d.base, page))) fail(`${d.base}/${page}: not built`);
}
if (!existsSync(join(dist, 'favicon.svg'))) fail('favicon.svg: missing from dist');
// 500 page: Vercel does not serve a static custom 500 page on its own, so it is checked here directly.
if (!existsSync(join(dist, '500.html'))) {
	fail('500.html: not built');
} else {
	const page500 = read('500.html');
	if (!/<h1[^>]*>[^<]*\b500\b[^<]*<\/h1>/.test(page500)) fail('500.html: the h1 must contain 500');
	if (!page500.includes('<meta name="robots" content="noindex">')) fail('500.html: missing noindex');
	if (/[\u2013\u2014]/.test(page500)) fail('500.html: contains an en or em dash');
}
for (const d of DESIGN_LIST) {
	const at = (f) => (d.base ? d.base.slice(1) + '/' : '') + f;
	const homesHtml = read(at('homes/index.html'));
	const chips = [...homesHtml.matchAll(/<button type="button" class="chip"[^>]*data-tag="[^"]+"[^>]*aria-pressed="(?:true|false)"/g)];
	if (chips.length !== 5) fail(`${at('homes/index.html')}: expected 5 aria-pressed filter chips, found ${chips.length}`);
	if ((homesHtml.match(/<li class="reveal" data-tags="\|[^"]+\|"/g) || []).length !== HOMES.length) fail(`${at('homes/index.html')}: cards need data-tags`);
	if (!read(at('homes/easystay/index.html')).includes('<dialog id="lightbox"')) fail(`${at('homes/easystay/index.html')}: missing lightbox dialog`);
	if (PREVIEW_ON && (!read(at('index.html')).includes('/assets/variants.css') || !read(at('index.html')).includes('/assets/variants.js'))) fail(`${at('index.html')}: variant files not referenced`);
	if (!read(at('index.html')).includes(CANONICAL)) fail(`${at('index.html')}: canonical description missing or changed`);
	for (const slug of HOMES) {
		for (const file of [at('homes/index.html'), at(`homes/${slug}/index.html`)]) {
			if (!read(file).includes(`view-transition-name: home-${slug}"`)) fail(`${file}: missing view-transition-name home-${slug}`);
		}
	}
}
// Earth images: only from rules scoped to [data-design="orbit"], and nowhere else in the built site.
for (const [, selector, body] of variantsCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
	if (/earth-night/.test(body) && !/\[data-design="orbit"\]/.test(selector)) fail(`assets/variants.css: earth image outside [data-design="orbit"]: ${selector.trim()}`);
}
for (const file of files.filter((f) => /\.(html|js|css)$/.test(f) && f !== 'assets/variants.css')) {
	if (/earth-night/.test(read(file))) fail(`${file}: earth image referenced outside the orbit rules`);
}
// Original layer: every rule is scoped to html[data-design="original"] (keyframes excepted, there are none).
// Split a selector list on the commas that sit outside parentheses, so :is(a, b) stays whole.
const topLevelParts = (list) => {
	const parts = [];
	let depth = 0;
	let cur = '';
	for (const ch of list) {
		if (ch === '(') depth++;
		if (ch === ')') depth--;
		if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
	}
	parts.push(cur.trim());
	return parts.filter(Boolean);
};
for (const [, selector] of themeCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)) {
	for (const part of topLevelParts(selector)) {
		if (!part.startsWith('[data-design="original"]')) fail(`assets/theme-original.css: selector not scoped to original: ${part}`);
	}
}
if (!/\.design-switcher-button\s*\{[^}]*min-height:\s*48px/.test(switcherCss)) fail('assets/switcher.css: switcher button must be at least 48px high');
if (!/\.design-switcher-glyph\s*\{/.test(switcherCss) || !/\.design-switcher-chev\s*\{/.test(switcherCss)) fail('assets/switcher.css: switcher needs a glyph and a chevron');
if (!/\[data-design="dawn"\]:not\(\.dawn-go\)[^{]*\{[^}]*reveal-fallback/.test(variantsCss)) fail('assets/variants.css: dawn hero has no reveal-fallback');
if (!read('index.html').includes('<meta name="robots" content="noindex">')) fail('index.html: missing noindex');
const robots = read('robots.txt');
if (!/^Disallow: \/$/m.test(robots)) fail('robots.txt: missing Disallow: /');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const hasNoindex = JSON.stringify(vercel.headers).includes('"X-Robots-Tag"') && JSON.stringify(vercel.headers).includes('"noindex"');
if (!hasNoindex) fail('vercel.json: X-Robots-Tag noindex header missing');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (pkg.type !== 'module') fail('package.json: type must be module');
if (!pkg.scripts?.test) fail('package.json: missing test script');
if (pkg.dependencies || pkg.devDependencies) fail('package.json: dependencies are not allowed');

// Motion and view-transition rules.
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
if (!css.includes('prefers-reduced-motion')) fail('styles.css: no prefers-reduced-motion block');
if (!css.includes('@view-transition')) fail('styles.css: no @view-transition rule');
if (!css.includes('reveal-fallback')) fail('styles.css: no reveal-fallback safety net for .reveal content');
// Every animation name used in styles.css must have a @keyframes rule. Keywords, times, timing functions, counts and var() are skipped.
const cssBare = (css + '\n' + variantsCss + '\n' + switcherCss + '\n' + themeCss).replace(/\/\*[\s\S]*?\*\//g, '');
const keyframeNames = new Set([...cssBare.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
const CSS_KEYWORD = /^(none|normal|reverse|alternate|alternate-reverse|forwards|backwards|both|infinite|running|paused|linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|auto|!important)$/;
const CSS_NOT_A_NAME = /^-?[\d.]+(m?s)?$/;
for (const [, value] of cssBare.matchAll(/(?<![\w-])animation(?:-name)?\s*:\s*([^;{}]+)/g)) {
	for (const part of value.replace(/[\w-]+\([^()]*\)/g, '').split(',')) {
		for (const token of part.trim().split(/\s+/)) {
			if (!token || CSS_KEYWORD.test(token) || CSS_NOT_A_NAME.test(token)) continue;
			if (!keyframeNames.has(token)) fail(`styles.css: animation "${token}" is used but has no @keyframes`);
		}
	}
}

// Unit checks: evaluate app.js with no document; the module.exports guard supplies the helpers.
const src = readFileSync(join(root, 'src/app.js'), 'utf8');
for (const file of files.filter((f) => /\.(js|html)$/.test(f))) {
	// The one exception: the Cinematic scrub hero needs scroll progress, so it registers a single passive
	// listener that only sets a target and wakes a rAF loop (the 10k-websites scrub standard).
	const scrollOk = file === 'assets/design-cinematic.js' && /addEventListener\('scroll', onScroll, \{ passive: true \}\)/.test(read(file));
	if (/addEventListener\(\s*['"]scroll['"]/.test(read(file)) && !scrollOk) fail(`${file}: scroll event listener is not allowed`);
}
const mod = { exports: {} };
new Function('document', 'module', src)(undefined, mod);
const h = mod.exports;
const eq = (actual, expected, label) => {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`app.js ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const TODAY = '2026-10-25';
eq(h.lhIsDate('2026-11-12'), true, 'valid date');
eq(h.lhIsDate('2026-02-30'), false, 'impossible date');
eq(h.lhIsDate('12/11/2026'), false, 'wrong format');
eq(h.lhIsDate(undefined), false, 'undefined');
eq(h.lhFormatDate('2026-11-12'), '12 Nov 2026', 'format date');
eq(h.lhParseGuests('2'), 2, 'guests digits');
eq(h.lhParseGuests(' 3 '), 3, 'guests with spaces');
eq(h.lhParseGuests(4), 4, 'guests number');
for (const bad of ['0', '1.5', '1e2', '', '-1', 'two']) eq(h.lhParseGuests(bad), null, `guests ${JSON.stringify(bad)}`);
eq(h.lhStayErrors('2026-11-12', '2026-11-15', '2', TODAY), {}, 'valid stay');
eq(Object.keys(h.lhStayErrors('2026-10-24', '2026-10-26', '2', TODAY)), ['in'], 'past check in');
eq(Object.keys(h.lhStayErrors('2026-11-12', '2026-11-12', '2', TODAY)), ['out'], 'same day check out');
eq(Object.keys(h.lhStayErrors('2026-11-12', '2026-11-10', '2', TODAY)), ['out'], 'check out before check in');
eq(Object.keys(h.lhStayErrors('2026-11-12', '2026-11-15', '0', TODAY)), ['guests'], 'zero guests');
eq(Object.keys(h.lhStayErrors('', '', '', TODAY)).sort(), ['guests', 'in', 'out'], 'blank fields');
eq(h.lhEstimate(95, '2026-11-12', '2026-11-15'), { nights: 3, total: 285 }, 'estimate');
eq(h.lhEstimate(95, '2026-11-15', '2026-11-12'), null, 'estimate reversed');
eq(h.lhEstimate(95, 'x', '2026-11-12'), null, 'estimate invalid');

if (failures.length) {
	console.error(failures.map((f) => '- ' + f).join('\n'));
	console.error(`\n${failures.length} problem(s).`);
	process.exit(1);
}
console.log(`ok: ${pages.length} pages, ${files.length} files, unit checks passed`);
