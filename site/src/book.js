// Booking flow for /book/ and /book/confirmed/. Preview only: nothing is sent or stored. Uses app.js globals.
(() => {
	const $ = (id) => document.getElementById(id);
	const params = new URLSearchParams(location.search);
	const homes = JSON.parse($('lh-homes')?.textContent || '{}');
	const nightsText = (n) => n + (n === 1 ? ' night' : ' nights');

	const stay = () => {
		const s = { home: params.get('home') || '', in: params.get('in') || '', out: params.get('out') || '', guests: params.get('guests') || '' };
		const home = Object.hasOwn(homes, s.home) ? homes[s.home] : null;
		if (!home || Object.keys(lhStayErrors(s.in, s.out, s.guests, lhTodayIso())).length) return null;
		const est = lhEstimate(home.rate, s.in, s.out);
		return { ...s, name: home.name, rate: home.rate, nights: est.nights, total: est.total, guests: lhParseGuests(s.guests) };
	};
	const row = (dl, label, value) => {
		const div = document.createElement('div');
		const dt = document.createElement('dt');
		const dd = document.createElement('dd');
		dt.textContent = label;
		dd.textContent = value;
		div.append(dt, dd);
		dl.append(div);
	};
	const summary = (s) => {
		const dl = document.createElement('dl');
		dl.className = 'summary-list';
		row(dl, 'Home', s.name);
		row(dl, 'Dates', lhFormatDate(s.in) + ' to ' + lhFormatDate(s.out));
		row(dl, 'Guests', s.guests + (s.guests === 1 ? ' guest' : ' guests'));
		row(dl, 'Sample rate', '£' + s.rate + ' a night x ' + nightsText(s.nights));
		row(dl, 'Sample total', '£' + s.total);
		return dl;
	};

	const s = stay();
	if (s && $('confirm-summary')) $('confirm-summary').replaceChildren(summary(s));

	const form = $('book-form');
	if (!form) return;
	const steps = [...form.querySelectorAll('.step')];
	const marks = [...document.querySelectorAll('.progress li')];
	if (s) $('book-review').replaceChildren(summary(s));

	const RULE = {
		name: (v) => (v.trim() ? '' : 'Enter your full name.'),
		email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter an email address, for example name@example.com.'),
		phone: (v) => (/^\+?[\d\s()-]+$/.test(v.trim()) && v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a phone number with at least 10 digits.'),
	};
	const check = (t) => {
		const msg = RULE[t.dataset.check](t.value);
		t.setAttribute('aria-invalid', String(msg !== ''));
		$(t.id + '-error').textContent = msg;
		return msg === '';
	};
	const validStep = (i) => {
		let ok = true;
		steps[i].querySelectorAll('[data-check]').forEach((t) => { if (!check(t) && ok) { ok = false; t.focus(); } });
		return ok;
	};

	form.classList.add('lh-steps');
	steps.forEach((el, i) => { el.hidden = i !== 0; });
	for (const k of ['home', 'in', 'out', 'guests']) $('f-' + k).value = params.get(k) || '';

	let current = 0;
	// Crossfade via View Transitions (200ms in styles.css); instant swap elsewhere.
	const show = (n) => {
		const swap = () => {
			current = n;
			steps.forEach((el, i) => { el.hidden = i !== n; });
			marks.forEach((el, i) => { if (i === n) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
			steps[n].querySelector('h2').focus();
		};
		document.startViewTransition ? document.startViewTransition(swap) : swap();
	};

	form.addEventListener('focusout', (e) => { if (e.target.dataset.check) check(e.target); });
	form.addEventListener('click', (e) => {
		const go = e.target.closest('[data-go]');
		if (!go) return;
		const to = current + Number(go.dataset.go);
		if (to > current && !validStep(current)) return;
		show(to);
	});
	// Enter moves forward. Only step 3 really submits.
	form.addEventListener('submit', (e) => {
		if (current < 2) {
			e.preventDefault();
			if (validStep(current)) show(current + 1);
		}
	});
})();
