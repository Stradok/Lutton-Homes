// Departures design: split-flap lettering and the board clock. No dependencies.
// Each [data-flap] keeps its real text for assistive tech; the flap tiles are decorative.
(function () {
	var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

	function span(cls, text) {
		var s = document.createElement('span');
		s.className = cls;
		if (text) s.textContent = text;
		return s;
	}
	function split(el) {
		var text = el.textContent.trim();
		var tiles = span('flap-tiles');
		tiles.setAttribute('aria-hidden', 'true');
		var flaps = [];
		text.split(' ').forEach(function (word, w) {
			if (w) tiles.appendChild(document.createTextNode(' '));
			var group = tiles.appendChild(span('flap-word'));
			word.split('').forEach(function (c) {
				var f = group.appendChild(span('flap', reduce ? c : ''));
				f.dataset.c = c;
				flaps.push(f);
			});
		});
		el.replaceChildren(span('flap-sr', text), tiles);
		return flaps;
	}

	// Each tile flips through a few random characters and lands on its letter; tiles land left to right.
	function run(flaps) {
		flaps.forEach(function (f, i) {
			var target = f.dataset.c;
			var left = 4 + (i % 7);
			(function tick() {
				if (left-- <= 0) { f.textContent = target; f.classList.add('is-set'); return; }
				f.textContent = /[A-Za-z0-9]/.test(target) ? CHARS[(Math.random() * CHARS.length) | 0] : target;
				f.classList.remove('is-tick');
				void f.offsetWidth;
				f.classList.add('is-tick');
				setTimeout(tick, 55);
			})();
		});
	}

	var els = [].slice.call(document.querySelectorAll('[data-flap]'));
	var seen = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(function (entries) {
		entries.forEach(function (e) {
			if (!e.isIntersecting) return;
			seen.unobserve(e.target);
			run(e.target._flaps);
		});
	}, { threshold: 0.3 }) : null;
	els.forEach(function (el) {
		el._flaps = split(el);
		if (reduce) return;
		if (seen) seen.observe(el); else run(el._flaps);
	});

	// Board clock: local time at Luton, updated every 15 seconds.
	var clock = document.querySelector('[data-clock]');
	if (clock) {
		var fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
		var show = function () { clock.textContent = fmt.format(new Date()); };
		show();
		setInterval(show, 15000);
	}
})();
