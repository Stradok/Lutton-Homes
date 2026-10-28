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
		const q = lhQuote(s.rate, s.nights);
		row(dl, 'Sample rate', '£' + s.rate + ' a night x ' + nightsText(s.nights));
		row(dl, 'Cleaning fee (sample)', '£' + q.cleaning);
		if (q.discount) row(dl, 'Stay of 7 nights or more, 10% off (sample)', '-£' + q.discount);
		row(dl, 'Sample total', '£' + q.total);
		return dl;
	};

	const s = stay();
	// The confirmation page: with a reference from the server the stay is real and waiting for the owners to confirm.
	if (params.get('ref') && $('confirm-summary') && document.querySelector('meta[name="lh-api"]')?.content) {
		document.querySelector('h1').textContent = 'Booking request received';
		document.querySelector('.lead').textContent = 'Reference: ' + params.get('ref');
		document.querySelectorAll('.notice').forEach((n) => { n.hidden = true; });
	}
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
	// With an API address (lh-api meta) the booking is sent for real: the nights are held and the guest goes to the payment
	// page, or to the confirmation page when the owners approve by hand. Without one this stays a preview.
	const api = document.querySelector('meta[name="lh-api"]')?.content.replace(/\/$/, '');
	if (api) document.querySelectorAll('.notice').forEach((n) => { n.hidden = true; });
	// Enter moves forward. Only step 3 really submits.
	form.addEventListener('submit', (e) => {
		if (current < 2) {
			e.preventDefault();
			if (validStep(current)) show(current + 1);
			return;
		}
		if (!api || !s) return;
		e.preventDefault();
		const err = $('book-error'), go = form.querySelector('[type="submit"]');
		err.textContent = '';
		go.disabled = true;
		fetch(api + '/api/bookings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ home: s.home, from: s.in, to: s.out, guests: s.guests, name: $('guest-name').value, email: $('guest-email').value }) })
			.then((r) => r.json().then((j) => ({ ok: r.ok, j })))
			.then(({ ok, j }) => {
				if (!ok) throw new Error(j.error || 'The booking could not be made.');
				location.href = j.checkoutUrl || form.action + '?' + new URLSearchParams({ home: s.home, in: s.in, out: s.out, guests: s.guests, ref: j.id });
			})
			.catch((x) => { err.textContent = x instanceof TypeError ? 'Could not reach the booking server. Try again.' : x.message; go.disabled = false; });
	});
})();
