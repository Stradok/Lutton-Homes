// Cinematic design: the scroll-scrubbed hero ("from orbit to your door") and the lights-on hold.
// Engineering follows the 10k-websites scrub standard: Blob fetch behind a progress ring with a stall
// watchdog, a frame-rate-independent lerp in a rAF loop that rests, gated seeks, delta-gated DOM writes,
// caption bands paced in scroll distance, five static-hero gates decided live, and a page that is complete
// if the video never arrives. One passive scroll listener sets the target; all work happens in the rAF loop.
(function () {
	var hero = document.querySelector('.cin-hero');
	if (!hero) return;
	var stage = hero.querySelector('.cin-stage');
	var video = hero.querySelector('.cin-video');
	var poster = hero.querySelector('.cin-poster');
	var ring = hero.querySelector('.cin-ring');
	var VIDEO_URL = '/media/cinematic/hero-scrub.mp4';
	var VIDEO_BYTES = 7358842;
	var POSTER_URL = '/media/cinematic/hero-poster.webp';
	var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
	var smoothstep = function (p, e0, e1) { var t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

	// ---------- Split headline text once, with seeded offsets so every load looks the same ----------
	function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
	[].forEach.call(hero.querySelectorAll('[data-split]'), function (node, n) {
		var text = node.textContent.trim();
		var r = rng(7 + n * 31);
		var visual = el('span', 'sx');
		visual.setAttribute('aria-hidden', 'true');
		var words = text.split(' ');
		var total = text.replace(/ /g, '').length, ci = 0;
		words.forEach(function (word, wi) {
			if (wi) visual.appendChild(document.createTextNode(' '));
			var w = visual.appendChild(el('span', 'w'));
			w.style.setProperty('--wi', String(wi / Math.max(1, words.length - 1)));
			word.split('').forEach(function (ch) {
				var c = w.appendChild(el('span', 'c', ch));
				c.style.setProperty('--th', (r() * 0.5).toFixed(3));
				c.style.setProperty('--jx', ((r() - 0.5) * 80).toFixed(1) + 'px');
				c.style.setProperty('--jy', ((r() - 0.5) * 60).toFixed(1) + 'px');
				c.style.setProperty('--jr', ((r() - 0.5) * 40).toFixed(1) + 'deg');
				c.style.setProperty('--ci', (ci++ / total).toFixed(3));
			});
		});
		node.replaceChildren(el('span', 'sr-only', text), visual);
	});

	// ---------- Bands ----------
	var bands = [].map.call(hero.querySelectorAll('[data-band]'), function (b, i, all) {
		var ab = b.dataset.band.split(',').map(Number);
		return { el: b, a: ab[0], b: ab[1], first: i === 0, last: i === all.length - 1, op: -1, k: -1 };
	});
	var loadK = 0;
	function heroProgress() {
		var range = hero.offsetHeight - innerHeight;
		return range > 0 ? clamp(-hero.getBoundingClientRect().top / range, 0, 1) : 0;
	}
	function updateCaptions(p) {
		bands.forEach(function (band) {
			var f = Math.min(0.02, (band.b - band.a) / 3);
			var inE = band.first ? 1 : smoothstep(p, band.a, band.a + f);
			var outE = band.last ? 0 : smoothstep(p, band.b - f, band.b);
			var op = inE * (1 - outE);
			var k = clamp((p - band.a) / Math.min(0.025, (band.b - band.a) * 0.35), 0, 1);
			if (band.first) k = Math.max(k, loadK);
			if (band.last && p >= band.b) k = 1;
			op = Math.round(op * 1000) / 1000;
			if (op !== band.op) { band.op = op; band.el.style.opacity = op; band.el.style.visibility = op ? 'visible' : 'hidden'; }
			if (Math.abs(k - band.k) > 0.008 || (k === 1 && band.k !== 1)) { band.k = k; band.el.style.setProperty('--k', k.toFixed(3)); }
		});
	}

	// ---------- Gated seeks ----------
	var seekBusy = false, pendingTime = null;
	function requestSeek(t) {
		if (!video.duration) return;
		if (seekBusy) { pendingTime = t; return; }
		seekBusy = true;
		video.currentTime = t;
	}
	video.addEventListener('seeked', function () {
		seekBusy = false;
		if (pendingTime !== null) { var t = pendingTime; pendingTime = null; requestSeek(t); }
	});
	video.addEventListener('error', function () { seekBusy = false; pendingTime = null; failVideo(); });

	// ---------- The rAF loop: eases toward the scroll target and rests when converged ----------
	var target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true, loadStart = 0;
	function tick(now) {
		var dt = Math.min(100, now - (lastTick || now));
		lastTick = now;
		shown += (target - shown) * (1 - Math.pow(1 - 0.16, dt / 16.667));
		if (loadK < 1) loadK = clamp((now - loadStart) / 900, 0, 1);
		if (Math.abs(target - shown) < 0.0005 && loadK >= 1) {
			shown = target; rafId = null; lastTick = 0;
		} else {
			rafId = requestAnimationFrame(tick);
		}
		requestSeek(shown * video.duration);
		updateCaptions(shown);
	}
	function kick() { if (rafId === null && heroOnScreen && scrubOn) rafId = requestAnimationFrame(tick); }
	function onScroll() { target = heroProgress(); kick(); }
	new IntersectionObserver(function (e) { heroOnScreen = e[0].isIntersecting; kick(); }).observe(hero);

	// ---------- The video: poster first, then the streamed Blob behind the ring ----------
	var heroInit = false;
	function initHeroOnce() {
		if (heroInit) return;
		heroInit = true;
		poster.style.backgroundImage = "url('" + POSTER_URL + "')";
		var started = false;
		var start = function () { if (started) return; started = true; loadHeroBlob().catch(failVideo); };
		var img = new Image();
		img.onload = start; img.onerror = start; img.src = POSTER_URL;
		setTimeout(start, 4000);
	}
	function loadHeroBlob() {
		var ctrl = new AbortController();
		var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
		var chunks = [];
		return fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal }).then(function (res) {
			if (!res.ok || !res.body) throw new Error('video ' + res.status);
			var total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
			var reader = res.body.getReader(), got = 0, lastRing = 0;
			function pump() {
				return reader.read().then(function (r) {
					if (r.done) return;
					clearTimeout(watchdog);
					watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
					chunks.push(r.value);
					got += r.value.length;
					var frac = Math.min(1, got / total), now = performance.now();
					if (now - lastRing > 100 || frac === 1) { lastRing = now; ring.style.setProperty('--ld', String(Math.round(126 * (1 - frac)))); }
					return pump();
				});
			}
			return pump();
		}).then(function () {
			clearTimeout(watchdog);
			ring.style.setProperty('--ld', '0');
			video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
			video.load();
			video.addEventListener('canplay', function () {
				stage.classList.add('video-ready');
				target = heroProgress();
				requestSeek(target * video.duration);
				kick();
			}, { once: true });
		});
	}
	function failVideo() {
		stage.classList.add('video-failed');
	}

	// ---------- The five static-hero gates, identical to the CSS, decided live ----------
	var GATES = [
		'(max-width: 720px)',
		'(orientation: portrait) and (max-width: 1024px)',
		'(orientation: portrait) and (pointer: coarse)',
		'(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
		'(prefers-reduced-motion: reduce)'
	];
	var scrubOn = false;
	function enableScrub() {
		if (scrubOn) return;
		scrubOn = true;
		initHeroOnce();
		addEventListener('scroll', onScroll, { passive: true });
		bands.forEach(function (b) { b.op = -1; b.k = -1; });
		loadStart = performance.now();
		onScroll();
	}
	function disableScrub() {
		if (!scrubOn) return;
		scrubOn = false;
		removeEventListener('scroll', onScroll);
		if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
		bands.forEach(function (b) { b.el.style.removeProperty('opacity'); b.el.style.removeProperty('visibility'); b.el.style.setProperty('--k', '1'); });
	}
	function applyHeroMode() {
		if (GATES.some(function (q) { return matchMedia(q).matches; })) disableScrub(); else enableScrub();
	}
	var MQLS = GATES.map(function (q) { return matchMedia(q); });
	MQLS.forEach(function (m) { m.addEventListener('change', function () { applyHeroMode(); pinHold(); }); });
	applyHeroMode();

	// ---------- The one interactive moment: hold to turn the lights on in the five homes ----------
	var hold = document.querySelector('[data-hold]');
	var wins = [].slice.call(document.querySelectorAll('[data-windows] li'));
	var hp = 0, holding = false, holdRaf = null, holdLast = 0, lit = -1, done = false;
	var reduce = matchMedia('(prefers-reduced-motion: reduce)');
	function paintHold() {
		hold.style.setProperty('--hp', String(Math.round(126 * (1 - hp))));
		var n = done ? wins.length : Math.floor(hp * wins.length + 0.0001);
		if (n !== lit) { lit = n; wins.forEach(function (w, i) { w.classList.toggle('is-lit', i < n); }); }
	}
	function holdTick(now) {
		var dt = Math.min(100, now - (holdLast || now));
		holdLast = now;
		hp = clamp(hp + (holding ? 1 : -1) * dt / 1600, 0, 1);
		if (hp >= 1 && !done) { done = true; hold.classList.add('is-done'); hold.querySelector('span').textContent = 'Lights on'; }
		paintHold();
		if ((holding && hp < 1) || (!holding && hp > 0 && !done)) holdRaf = requestAnimationFrame(holdTick);
		else { holdRaf = null; holdLast = 0; }
	}
	function setHolding(on) {
		if (done) return;
		holding = on;
		if (holdRaf === null) holdRaf = requestAnimationFrame(holdTick);
	}
	function pinHold() {
		if (!hold || !reduce.matches) return;
		hp = 1; done = true; hold.classList.add('is-done'); hold.querySelector('span').textContent = 'Lights on'; paintHold();
	}
	if (hold) {
		hold.addEventListener('pointerdown', function (e) { e.preventDefault(); hold.setPointerCapture(e.pointerId); setHolding(true); });
		['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { hold.addEventListener(t, function () { setHolding(false); }); });
		hold.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); setHolding(true); } });
		hold.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') setHolding(false); });
		hold.addEventListener('blur', function () { setHolding(false); });
		pinHold();
	}

	// Pause every loop on hidden tabs.
	document.addEventListener('visibilitychange', function () { document.body.classList.toggle('paused', document.hidden); });
})();
