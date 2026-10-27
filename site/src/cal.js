// Client Original: Airbnb-style date picker with sample availability, a price breakdown and a free-homes filter. Preview only.
// Uses the globals from app.js and quote.js. The real date inputs stay in the form as hidden fields, so app.js validation is unchanged.
document.addEventListener('DOMContentLoaded', () => {
	const $ = (id) => document.getElementById(id);
	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const day = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 864e5);
	const iso = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
	const today = day(lhTodayIso());
	// Sample availability: a fixed pattern per home, three booked nights in every thirteen. The real calendar comes from the channel manager.
	const taken = (slug, n) => slug !== '' && (n + [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1009, 7)) % 13 < 3;
	const freeRange = (slug, a, b) => { for (let n = day(a); n < day(b); n++) if (taken(slug, n)) return false; return true; };
	const nightsText = (n) => n + (n === 1 ? ' night' : ' nights');

	const monthHtml = (y, m, cell) => {
		const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
		const total = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
		let out = '<div class="c3-month"><h3>' + MONTHS[m] + ' ' + y + '</h3><div class="c3-grid">' + ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => '<span class="c3-dow">' + d + '</span>').join('') + '<span></span>'.repeat(lead);
		for (let d = 1; d <= total; d++) out += cell(Math.floor(Date.UTC(y, m, d) / 864e5), d);
		return out + '</div></div>';
	};

	document.querySelectorAll('form').forEach((form) => {
		const fin = form.elements.in;
		const fout = form.elements.out;
		if (!fin || !fout || fin.type !== 'date') return;
		const slug = form.elements.home?.value || '';
		const cal = document.createElement('div');
		cal.className = 'c3-cal';
		cal.hidden = true;
		cal.setAttribute('role', 'dialog');
		cal.setAttribute('aria-label', 'Choose dates');
		const trig = {};
		for (const [k, input] of [['in', fin], ['out', fout]]) {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'c3-date';
			b.id = input.id;
			b.dataset.label = form.querySelector('label[for="' + input.id + '"]').textContent;
			b.setAttribute('aria-haspopup', 'dialog');
			if (input.getAttribute('aria-describedby')) b.setAttribute('aria-describedby', input.getAttribute('aria-describedby'));
			input.id += '-value';
			input.type = 'hidden';
			input.removeAttribute('aria-describedby');
			input.before(b);
			trig[k] = b;
		}
		const slot = fout.closest('.field');
		if (slot) slot.after(cal); else form.append(cal);

		const label = () => {
			for (const [k, input] of [['in', fin], ['out', fout]]) {
				trig[k].textContent = input.value ? lhFormatDate(input.value) : 'Add date';
				trig[k].setAttribute('aria-label', trig[k].dataset.label + ': ' + (input.value ? lhFormatDate(input.value) : 'not set'));
			}
		};
		const changed = () => {
			label();
			form.querySelectorAll('[data-err="in"], [data-err="out"]').forEach((e) => { e.textContent = ''; });
			fin.dispatchEvent(new Event('input', { bubbles: true }));
		};
		let view = new Date(fin.value ? day(fin.value) * 864e5 : today * 864e5);
		view = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth(), 1));
		const render = () => {
			const a = fin.value ? day(fin.value) : null;
			const b = fout.value ? day(fout.value) : null;
			let limit = Infinity;
			if (a !== null && b === null) { limit = a + 1; while (limit < a + 400 && !taken(slug, limit)) limit++; }
			const cell = (n, d) => {
				const gone = n < today || taken(slug, n);
				const ok = !gone && (a === null || b !== null || n <= a) || (a !== null && b === null && n > a && n <= limit && n >= today);
				const cls = (a === n ? ' is-start' : '') + (b === n ? ' is-end' : '') + (a !== null && b !== null && n > a && n < b ? ' is-range' : '') + (n >= today && taken(slug, n) ? ' is-taken' : '');
				return '<button type="button" class="c3-day' + cls + '" data-d="' + iso(n) + '"' + (ok ? '' : ' disabled') + ' aria-label="' + lhFormatDate(iso(n)) + (n >= today && taken(slug, n) ? ', booked' : '') + '"' + (a === n || b === n ? ' aria-pressed="true"' : '') + '>' + d + '</button>';
			};
			const y = view.getUTCFullYear();
			const m = view.getUTCMonth();
			const now = new Date(today * 864e5);
			const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
			const hint = a === null ? 'Choose your check-in date.' : b === null ? 'Choose your check-out date.' : nightsText(b - a) + ' selected.';
			cal.innerHTML = '<div class="c3-cal-nav"><button type="button" class="c3-nav" data-step="-1" aria-label="Previous month"' + (view.getTime() <= first ? ' disabled' : '') + '>&#8249;</button><p class="c3-hint">' + hint + '</p><button type="button" class="c3-nav" data-step="1" aria-label="Next month">&#8250;</button></div><div class="c3-months">' + monthHtml(y, m, cell) + monthHtml(m === 11 ? y + 1 : y, (m + 1) % 12, cell) + '</div><div class="c3-cal-foot"><p class="note">Sample availability.</p><button type="button" class="c3-clear" data-clear>Clear dates</button></div>';
		};
		const open = (k) => { render(); cal.hidden = false; (cal.querySelector('.is-start') || cal.querySelector('.c3-day:not(:disabled)') || cal.querySelector('.c3-nav:not(:disabled)')).focus(); cal.dataset.from = k; };
		const close = (k) => { cal.hidden = true; trig[k || cal.dataset.from || 'in'].focus(); };
		for (const k of ['in', 'out']) trig[k].addEventListener('click', () => (cal.hidden ? open(k) : close(k)));
		cal.addEventListener('click', (e) => {
			const btn = e.target.closest('button');
			if (!btn) return;
			const again = (sel) => { const t = cal.querySelector(sel); (t && !t.disabled ? t : cal.querySelector('.c3-nav:not(:disabled)')).focus(); };
			if (btn.dataset.step) { view = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + Number(btn.dataset.step), 1)); render(); again('[data-step="' + btn.dataset.step + '"]'); return; }
			if (btn.hasAttribute('data-clear')) { fin.value = ''; fout.value = ''; changed(); render(); again('[data-clear]'); return; }
			const n = day(btn.dataset.d);
			if (!fin.value || fout.value || n <= day(fin.value)) { fin.value = btn.dataset.d; fout.value = ''; } else fout.value = btn.dataset.d;
			changed();
			render();
			if (fout.value) close('out'); else again('[data-d="' + btn.dataset.d + '"]');
		});
		form.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !cal.hidden) { e.stopPropagation(); close(); return; }
			const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
			if (step && e.target.dataset.d) { e.preventDefault(); const t = cal.querySelector('[data-d="' + iso(day(e.target.dataset.d) + step) + '"]'); if (t && !t.disabled) t.focus(); }
		});
		// Tabbing out of the picker closes it.
		cal.addEventListener('focusout', (e) => { if (e.relatedTarget && !cal.contains(e.relatedTarget) && !e.relatedTarget.closest('.c3-date')) cal.hidden = true; });
		document.addEventListener('click', (e) => { if (!cal.hidden && !e.composedPath().includes(cal) && !e.target.closest('.c3-date')) cal.hidden = true; });
		if (fin.value && slug && !freeRange(slug, fin.value, fout.value || iso(day(fin.value) + 1))) {
			fin.value = '';
			fout.value = '';
			form.querySelector('[data-err="in"]').textContent = 'Those dates are booked (sample). Choose other dates.';
			fin.dispatchEvent(new Event('input', { bubbles: true }));
		}
		label();
	});

	// Price breakdown in the booking panel, in place of the single sample total.
	const panel = $('booking-form');
	if (panel) {
		const rate = Number(panel.dataset.rate);
		const box = $('booking-estimate');
		const dl = document.createElement('dl');
		dl.className = 'c3-quote';
		box.append(dl);
		const show = () => {
			const est = lhEstimate(rate, panel.elements.in.value, panel.elements.out.value);
			dl.replaceChildren();
			if (!est) return;
			const q = lhQuote(rate, est.nights);
			const rows = [['£' + rate + ' x ' + nightsText(est.nights), '£' + q.stay], ['Cleaning fee (sample)', '£' + q.cleaning]];
			if (q.discount) rows.push(['Stay of 7 nights or more, 10% off (sample)', '-£' + q.discount]);
			rows.push(['Total (sample)', '£' + q.total]);
			rows.forEach(([a, b], i) => {
				const div = document.createElement('div');
				if (i === rows.length - 1) div.className = 'c3-quote-total';
				const dt = document.createElement('dt');
				const dd = document.createElement('dd');
				dt.textContent = a;
				dd.textContent = b;
				div.append(dt, dd);
				dl.append(div);
			});
			$('booking-nights').textContent = 'Sample total £' + q.total + ' for ' + nightsText(est.nights) + ', with the cleaning fee.';
			$('bar-text').textContent = '£' + q.total + ' for ' + nightsText(est.nights) + ' (sample)';
		};
		panel.addEventListener('input', show);
		show();
	}

	// Only free homes: on the homes list, hide homes whose sample calendar is booked inside the chosen dates.
	const list = $('home-list');
	const q = new URLSearchParams(location.search);
	if (list && lhIsDate(q.get('in')) && lhIsDate(q.get('out')) && q.get('out') > q.get('in')) {
		let free = 0;
		for (const li of list.children) {
			const slug = new URL(li.querySelector('a').href).pathname.split('/').filter(Boolean).pop();
			if (freeRange(slug, q.get('in'), q.get('out'))) free++; else li.dataset.busy = '';
		}
		const p = document.createElement('p');
		p.className = 'note c3-avail';
		p.setAttribute('role', 'status');
		p.textContent = (free ? free + (free === 1 ? ' home is' : ' homes are') : 'No homes are') + ' free for ' + lhFormatDate(q.get('in')) + ' to ' + lhFormatDate(q.get('out')) + ' (sample availability).' + (free ? '' : ' Try other dates.');
		list.before(p);
	}
});
