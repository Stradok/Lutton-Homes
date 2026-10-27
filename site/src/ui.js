// Client Original pickers: the "Where" list, the "Guests" stepper panel, the Homes menu and the card rail.
// Nothing here sends or stores anything. The hidden inputs keep the form working for app.js.
(function () {
	'use strict';
	var RAIL_AFTER = 8; // more cards than this stop wrapping and become a row you step through with arrows

	function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

	// One open/close behaviour for a popup attached to a button: outside click, Escape and tabbing out all close it.
	function wire(host, btn, pop) {
		function set(open) { pop.hidden = !open; btn.setAttribute('aria-expanded', String(open)); }
		btn.addEventListener('click', function () { var open = pop.hidden; closeAll(); set(open); });
		document.addEventListener('click', function (e) { if (!pop.hidden && !e.composedPath().includes(host)) set(false); });
		host.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { set(false); btn.focus(); } });
		host.addEventListener('focusout', function (e) { if (!pop.hidden && e.relatedTarget && !host.contains(e.relatedTarget)) set(false); });
		host._set = set;
		return set;
	}
	function closeAll() { document.querySelectorAll('[data-where], [data-guests]').forEach(function (h) { if (h._set) h._set(false); }); }

	// Where: a list of every property, grouped. Picking one sends the search to that property's page.
	document.querySelectorAll('[data-where]').forEach(function (host) {
		var btn = host.querySelector('.c3-pick'), pop = host.querySelector('.c3-pop'), out = btn.querySelector('span'), form = host.closest('form');
		var set = wire(host, btn, pop);
		pop.addEventListener('click', function (e) {
			var a = e.target.closest('a'); if (!a) return;
			e.preventDefault();
			out.textContent = a.dataset.label || a.textContent;
			out.classList.toggle('is-set', !a.hasAttribute('data-all'));
			if (a.hasAttribute('data-all')) delete form.dataset.go; else form.dataset.go = a.href;
			set(false); btn.focus();
		});
		form.addEventListener('submit', function (e) { if (!e.defaultPrevented && form.dataset.go) form.action = form.dataset.go; });
	});

	// Guests: adults, children, infants and pets. Adults plus children fill the real "guests" input; infants and pets do not count.
	var ROWS = [['adults', 'Adults', 'Age 13+', 1], ['children', 'Children', 'Ages 2 to 12', 0], ['infants', 'Infants', 'Under 2', 0], ['pets', 'Pets', 'Pet rules to be confirmed (sample)', 0]];
	document.querySelectorAll('[data-guests]').forEach(function (host) {
		var btn = host.querySelector('.c3-pick'), out = btn.querySelector('span'), input = host.querySelector('input'), max = +host.dataset.max || 6;
		var n = { adults: Math.min(max, Math.max(1, parseInt(input.value, 10) || 1)), children: 0, infants: 0, pets: 0 };
		var pop = el('div', 'c3-pop c3-gpop'); pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Guests');
		var vals = {}, minus = {}, plus = {};
		ROWS.forEach(function (r) {
			var row = el('div', 'c3-grow', '<div><b>' + r[1] + '</b><span>' + r[2] + '</span></div>');
			var ctl = el('div', 'c3-step');
			minus[r[0]] = el('button', 'c3-stepb', '&minus;'); minus[r[0]].type = 'button'; minus[r[0]].setAttribute('aria-label', 'Fewer ' + r[1].toLowerCase());
			plus[r[0]] = el('button', 'c3-stepb', '+'); plus[r[0]].type = 'button'; plus[r[0]].setAttribute('aria-label', 'More ' + r[1].toLowerCase());
			vals[r[0]] = el('span', 'c3-stepv'); vals[r[0]].setAttribute('aria-live', 'polite');
			ctl.append(minus[r[0]], vals[r[0]], plus[r[0]]); row.append(ctl); pop.append(row);
			ctl.addEventListener('click', function (e) {
				var b = e.target.closest('button'); if (!b || b.disabled) return;
				n[r[0]] += b === plus[r[0]] ? 1 : -1; paint(true);
				// A button that just hit its limit is disabled and drops focus; hand it to the other button, or Close, so the keyboard keeps working.
				if (b.disabled) { var o = b === plus[r[0]] ? minus[r[0]] : plus[r[0]]; (o.disabled ? close : o).focus(); }
			});
		});
		pop.append(el('p', 'note', 'This place has a maximum of ' + max + ' guests, not including infants. (sample)'));
		var close = el('button', 'c3-close', 'Close'); close.type = 'button'; pop.append(close);
		host.append(pop);
		var set = wire(host, btn, pop);
		close.addEventListener('click', function () { set(false); btn.focus(); });
		function paint(fire) {
			var g = n.adults + n.children;
			ROWS.forEach(function (r) {
				vals[r[0]].textContent = n[r[0]];
				minus[r[0]].disabled = n[r[0]] <= r[3];
				plus[r[0]].disabled = r[0] === 'infants' ? n.infants >= 5 : r[0] === 'pets' ? n.pets >= 2 : g >= max;
			});
			out.textContent = g + (g === 1 ? ' guest' : ' guests') + (n.infants ? ', ' + n.infants + (n.infants === 1 ? ' infant' : ' infants') : '') + (n.pets ? ', ' + n.pets + (n.pets === 1 ? ' pet' : ' pets') : '');
			if (fire && input.value !== String(g)) { input.value = g; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }
		}
		paint(false);
	});

	// Homes menu in the header: the caret button opens it for touch and keyboard (hover and focus open it in CSS).
	document.querySelectorAll('.c3-dd').forEach(function (dd) {
		var b = dd.querySelector('.c3-dd-btn');
		b.addEventListener('click', function () { var o = dd.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(o)); });
		document.addEventListener('click', function (e) { if (!e.composedPath().includes(dd)) { dd.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); } });
		dd.addEventListener('keydown', function (e) { if (e.key === 'Escape') { dd.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); b.focus(); } });
	});

	// Property pages: every WhatsApp link opens a message that names the home and the page the guest was on.
	var ask = document.querySelector('[data-ask]');
	if (ask) document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) { a.href = a.getAttribute('href').split('?')[0] + '?text=' + encodeURIComponent(ask.dataset.ask + '\n' + location.href); });

	// Card rail: a few cards wrap into a grid; past RAIL_AFTER they become one scrolling row with arrows.
	document.querySelectorAll('.home-cards').forEach(function (ul) {
		if (ul.children.length <= RAIL_AFTER) return;
		ul.classList.add('is-rail');
		var ctl = el('div', 'c3-rail-ctl'), prev = el('button', 'c3-nav', '&lsaquo;'), next = el('button', 'c3-nav', '&rsaquo;');
		prev.type = next.type = 'button'; prev.setAttribute('aria-label', 'Previous homes'); next.setAttribute('aria-label', 'Next homes');
		ctl.append(prev, next); ul.before(ctl);
		function sync() { prev.disabled = ul.scrollLeft < 4; next.disabled = ul.scrollLeft + ul.clientWidth >= ul.scrollWidth - 4; }
		prev.addEventListener('click', function () { ul.scrollBy({ left: -ul.clientWidth * 0.9, behavior: 'smooth' }); setTimeout(sync, 600); }); // the timeout covers browsers without scrollend
		next.addEventListener('click', function () { ul.scrollBy({ left: ul.clientWidth * 0.9, behavior: 'smooth' }); setTimeout(sync, 600); });
		ul.addEventListener('scrollend', sync); addEventListener('resize', sync); sync(); // scrollend fires after the arrows or a swipe finish
	});
})();
