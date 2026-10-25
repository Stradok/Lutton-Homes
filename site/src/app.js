// Browser script; each part runs only where its elements exist.
const LH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LH_ERR = {
	in: 'Choose a check-in date from today onwards.',
	out: 'Choose a check-out date after your check-in date.',
	guests: 'Enter a whole number of guests, 1 or more.',
};

// Real calendar date, YYYY-MM-DD.
function lhIsDate(value) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(value + 'T00:00:00Z');
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function lhFormatDate(value) {
	const [year, month, day] = value.split('-');
	return Number(day) + ' ' + LH_MONTHS[Number(month) - 1] + ' ' + year;
}

// Whole number of 1 or more; null otherwise.
function lhParseGuests(value) {
	const text = String(value).trim();
	const n = /^\d+$/.test(text) ? Number(text) : NaN;
	return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

// Field errors by name; empty object means valid.
function lhStayErrors(checkin, checkout, guests, todayIso) {
	const errors = {};
	if (!lhIsDate(checkin) || (lhIsDate(todayIso) && checkin < todayIso)) errors.in = LH_ERR.in;
	if (!lhIsDate(checkout) || checkout <= checkin) errors.out = LH_ERR.out;
	if (lhParseGuests(guests) === null) errors.guests = LH_ERR.guests;
	return errors;
}

// Nights and sample total, or null.
function lhEstimate(rate, checkin, checkout) {
	if (!lhIsDate(checkin) || !lhIsDate(checkout) || checkout <= checkin) return null;
	const nights = (Date.parse(checkout + 'T00:00:00Z') - Date.parse(checkin + 'T00:00:00Z')) / 864e5;
	return { nights, total: nights * rate };
}

// Local date as YYYY-MM-DD.
const lhTodayIso = () => new Date().toLocaleDateString('en-CA');

if (typeof document !== 'undefined') {
	document.documentElement.classList.add('js-ready');
	const $ = (id) => document.getElementById(id);
	const today = lhTodayIso();
	const nightsText = (n) => n + (n === 1 ? ' night' : ' nights');
	const reduce = matchMedia('(prefers-reduced-motion: reduce)');

	const lhCheck = (form) => {
		const stay = {};
		for (const n of ['in', 'out', 'guests']) stay[n] = form.elements[n].value;
		const errors = lhStayErrors(stay.in, stay.out, stay.guests, today);
		for (const n of ['in', 'out', 'guests']) {
			form.querySelector('[data-err="' + n + '"]').textContent = errors[n] || '';
			form.elements[n].setAttribute('aria-invalid', String(Boolean(errors[n])));
		}
		return Object.keys(errors).length ? null : stay;
	};
	const lhLimits = (form) => {
		form.elements.in.min = today;
		form.elements.in.addEventListener('change', () => { form.elements.out.min = form.elements.in.value; });
	};

	const search = $('search-form');
	if (search) {
		lhLimits(search);
		search.addEventListener('submit', (event) => {
			event.preventDefault();
			const stay = lhCheck(search);
			if (stay) location.href = search.action + '?' + new URLSearchParams(stay);
		});
	}

	const q = new URLSearchParams(location.search);
	const qStay = { in: q.get('in') || '', out: q.get('out') || '', guests: q.get('guests') || '' };
	// A valid query stay is carried onto links, the summary and card estimates.
	if (Object.keys(lhStayErrors(qStay.in, qStay.out, qStay.guests, today)).length === 0) {
		const qs = new URLSearchParams(qStay).toString();
		document.querySelectorAll('a[data-carry]').forEach((a) => { a.href = a.getAttribute('href') + '?' + qs; });
		document.querySelectorAll('[data-est]').forEach((el) => {
			const est = lhEstimate(Number(el.closest('[data-rate]').dataset.rate), qStay.in, qStay.out);
			el.textContent = nightsText(est.nights) + ' from £' + est.total + '. Estimate from sample rates.';
			el.hidden = false;
		});
		if ($('stay-summary')) {
			const n = Number(qStay.guests);
			$('stay-text').textContent = lhFormatDate(qStay.in) + ' to ' + lhFormatDate(qStay.out) + ', ' + n + (n === 1 ? ' guest' : ' guests');
			$('stay-summary').hidden = false;
		}
	}

	// Booking panel: prefilled from the query. The total counts up on change; the phone bar shows it too.
	const panel = $('booking-form');
	if (panel) {
		const rate = Number(panel.dataset.rate);
		let shown = 0;
		let frame = 0;
		const showEstimate = (animate) => {
			const { in: checkin, out: checkout, guests } = panel.elements;
			const valid = Object.keys(lhStayErrors(checkin.value, checkout.value, guests.value, today)).length === 0;
			const est = valid ? lhEstimate(rate, checkin.value, checkout.value) : null;
			const from = shown;
			cancelAnimationFrame(frame);
			shown = est ? est.total : 0;
			$('booking-nights').textContent = est ? nightsText(est.nights) + ' at £' + rate + ' a night. Sample total £' + est.total + '.' : 'Choose dates to see a sample total.';
			$('bar-text').textContent = est ? '£' + est.total + ' for ' + nightsText(est.nights) + ' (sample)' : 'From £' + rate + ' a night (sample)';
			if (!est) { $('booking-sum').textContent = ''; return; }
			const t0 = performance.now();
			const step = (now) => {
				const p = animate && !reduce.matches ? Math.min(1, (now - t0) / 300) : 1;
				$('booking-sum').textContent = '£' + Math.round(from + (shown - from) * (1 - (1 - p) ** 3));
				if (p < 1) frame = requestAnimationFrame(step);
			};
			step(t0);
		};
		lhLimits(panel);
		for (const name of ['in', 'out', 'guests']) if (q.get(name)) panel.elements[name].value = q.get(name);
		panel.elements.out.min = panel.elements.in.value;
		panel.addEventListener('input', () => showEstimate(true));
		panel.addEventListener('submit', (event) => {
			event.preventDefault();
			const stay = lhCheck(panel);
			if (stay) location.href = panel.action + '?' + new URLSearchParams({ home: panel.elements.home.value, ...stay });
		});
		showEstimate(false);
	}

	// Reveal once. Content is visible without JS and under reduced motion; .is-in is added on first entry.
	const header = document.querySelector('.site-header');
	if ('IntersectionObserver' in window) {
		const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
			if (e.isIntersecting) { e.target.classList.add('is-in'); seen.unobserve(e.target); }
		}), { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
		document.querySelectorAll('.reveal, .steps').forEach((el) => seen.observe(el));
		// Nav solid state without scroll timelines: a sentinel at the bottom of the first band.
		const top = document.querySelector('.hero, .page-band');
		if (header && top && !CSS.supports('animation-timeline: view()')) new IntersectionObserver(([e]) => header.classList.toggle('is-solid', !e.isIntersecting)).observe(top);
	}

	// Hero depth: fine pointers with motion allowed. Clouds and contrail follow through custom properties.
	const hero = document.querySelector('.hero');
	if (hero && matchMedia('(pointer: fine)').matches && !reduce.matches) {
		let frame = 0;
		const put = (x, y) => { frame = 0; hero.style.setProperty('--mx', x.toFixed(3)); hero.style.setProperty('--my', y.toFixed(3)); };
		hero.addEventListener('pointermove', (e) => {
			if (!frame) frame = requestAnimationFrame(() => put((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1));
		});
		hero.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); put(0, 0); });
	}

	// Mobile menu: Escape or the button closes it; Tab stays in the header; focus returns to the button.
	const menu = document.querySelector('[data-menu]');
	if (header && menu) {
		const isOpen = () => header.classList.contains('is-open');
		const setOpen = (open) => {
			header.classList.toggle('is-open', open);
			menu.setAttribute('aria-expanded', String(open));
			document.querySelectorAll('main, footer').forEach((el) => { el.inert = open; });
			document.documentElement.style.overflow = open ? 'hidden' : '';
			if (open) header.querySelector('.site-nav a').focus();
		};
		const close = () => { setOpen(false); menu.focus(); };
		menu.addEventListener('click', () => (isOpen() ? close() : setOpen(true)));
		header.addEventListener('click', (e) => { if (isOpen() && e.target.closest('.site-nav a')) close(); });
		document.addEventListener('keydown', (e) => {
			if (!isOpen()) return;
			if (e.key === 'Escape') return close();
			if (e.key !== 'Tab') return;
			const items = header.querySelectorAll('a[href], button');
			const end = e.shiftKey ? items[0] : items[items.length - 1];
			if (document.activeElement === end) { e.preventDefault(); (e.shiftKey ? items[items.length - 1] : items[0]).focus(); }
		});
		matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
	}
}

if (typeof module !== 'undefined') module.exports = { lhIsDate, lhFormatDate, lhParseGuests, lhStayErrors, lhEstimate };
