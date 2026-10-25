// Home page design variants. Loaded by index.html only; the sky design does nothing here.
(function () {
	var root = document.documentElement;
	var hero = document.querySelector('.hero');
	if (!hero) return;
	if (root.dataset.design === 'dawn') dawn();
	if (root.dataset.design === 'orbit') orbit();

	// Counter follows real progress (fonts half, load half), never faster than 900ms and never slower than 1600ms.
	// The frame is drawn at rest too: without the intro (reduced motion, or seen this session) it appears complete.
	function dawn() {
		var pending = root.classList.contains('dawn-pending');
		var t0 = performance.now();
		var real = 0;
		(document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { real += 0.5; });
		(document.readyState === 'complete' ? Promise.resolve() : new Promise(function (ok) { addEventListener('load', ok, { once: true }); })).then(function () { real += 0.5; });
		hero.insertAdjacentHTML('beforeend', (pending ? '<p class="dawn-count" aria-hidden="true">0%</p>' : '')
			+ '<svg class="dawn-frame" aria-hidden="true"><rect pathLength="1" rx="20"/></svg>'
			+ (pending ? '<p class="sr-only" role="status">Loading</p>' : ''));
		var count = hero.querySelector('.dawn-count');
		var frame = hero.querySelector('.dawn-frame');
		var rect = frame.firstChild;
		var box = hero.getBoundingClientRect();
		var w = Math.round(box.width);
		var h = Math.round(box.height);
		frame.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
		frame.setAttribute('width', w);
		frame.setAttribute('height', h);
		rect.setAttribute('x', 16);
		rect.setAttribute('y', 16);
		rect.setAttribute('width', w - 32);
		rect.setAttribute('height', h - 32);
		if (!pending) { frame.classList.add('is-done'); return; }
		try { sessionStorage.setItem('lh-dawn-seen', '1'); } catch (e) { /* the intro may replay in a new tab */ }

		var shown = 0;
		requestAnimationFrame(function tick(now) {
			var elapsed = now - t0;
			var target = elapsed >= 1600 ? 1 : real;
			shown = Math.max(shown, Math.floor(Math.min(target, elapsed / 900) * 100));
			count.textContent = shown + '%';
			rect.style.strokeDashoffset = String(1 - shown / 100);
			if (shown < 100) return requestAnimationFrame(tick);
			root.classList.add('dawn-go');
			root.classList.remove('dawn-pending');
			count.classList.add('is-out');
			frame.classList.add('is-done');
			setTimeout(function () { count.remove(); }, 600);
		});
	}

	function orbit() {
		var sky = hero.querySelector('.hero-sky');
		var lead = hero.querySelector('.lead');
		var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		var names = [].map.call(document.querySelectorAll('.home-card-body h3'), function (h) { return h.textContent; });
		// Five points on the ring, one per home, 72 degrees apart. They travel with SMIL so the path follows the tilted ring; reduced motion places them still.
		var RING = 'M 4 100 A 96 30 0 1 0 196 100 A 96 30 0 1 0 4 100 Z';
		var dots = names.map(function (name, i) {
			var a = i * 72 * Math.PI / 180;
			var at = still ? ' cx="' + (100 + 96 * Math.cos(a)).toFixed(2) + '" cy="' + (100 + 30 * Math.sin(a)).toFixed(2) + '"' : '';
			var travel = still ? '' : '<animateMotion dur="60s" begin="-' + i * 12 + 's" repeatCount="indefinite" path="' + RING + '"/>';
			return '<circle class="orbit-dot" r="0.5"' + at + '><title>' + name + '</title>' + travel + '</circle>';
		}).join('');
		sky.insertAdjacentHTML('beforeend', '<div class="orbit-scene" aria-hidden="true"><div class="orbit-globe"></div>'
			+ '<svg class="orbit-ring" viewBox="0 0 200 200" focusable="false"><g transform="rotate(-14 100 100)"><ellipse cx="100" cy="100" rx="96" ry="30"/>' + dots + '</g></svg></div>');
		lead.insertAdjacentHTML('afterend', '<a class="orbit-skip" href="#homes">Skip to homes</a>');
		var footer = document.querySelector('.footer-contact');
		if (footer) footer.insertAdjacentHTML('beforeend', '<p class="orbit-credit">Earth at night: NASA Earth Observatory</p>');

		// The descent needs motion. Scroll timelines drive it where they exist; elsewhere markers step it. Without either, the orbit screen is the whole story.
		var homes = document.getElementById('homes');
		var timeline = CSS.supports('animation-timeline: view()');
		if (!homes || still || (!timeline && !('IntersectionObserver' in window))) return;
		var marks = timeline ? '' : '<span class="d-mark d-mark--europe" data-stage="europe"></span>'
			+ '<span class="d-mark d-mark--england" data-stage="england"></span>'
			+ '<span class="d-mark d-mark--clouds" data-stage="clouds"></span>';
		homes.insertAdjacentHTML('beforebegin', '<section class="descent" aria-hidden="true"><div class="descent-stage">'
			+ '<div class="d-globe"></div><div class="d-close"></div><div class="d-dawn"></div><div class="d-cloud"></div>'
			+ '<div class="d-pin"><span class="d-pin-label">Luton Airport</span></div></div>' + marks + '</section>');
		if (timeline) return;
		var stage = document.querySelector('.descent-stage');
		var steps = [].slice.call(document.querySelectorAll('.d-mark'));
		// The observer watches a thin band across the middle of the screen. The last marker above that middle sets the stage; none means the orbit.
		var io = new IntersectionObserver(function () {
			var step = '';
			steps.forEach(function (m) { if (m.getBoundingClientRect().top < innerHeight / 2) step = m.dataset.stage; });
			stage.className = 'descent-stage' + (step ? ' is-' + step : '');
		}, { rootMargin: '-45% 0px -45% 0px' });
		steps.forEach(function (m) { io.observe(m); });
	}
})();
