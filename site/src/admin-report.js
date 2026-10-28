// Owner dashboard: booking source report and calendar sync status. Shows made-up sample figures until an API address and
// admin token are entered, then loads the real report from backend/api. Values are written with textContent, never as HTML.
(function () {
	'use strict';
	var root = document.getElementById('reports');
	if (!root) return;
	var $ = function (id) { return document.getElementById(id); };
	var NAMES = { direct: 'This website', airbnb: 'Airbnb', booking: 'Booking.com', manual: 'Entered by hand' };
	var ORDER = ['direct', 'airbnb', 'booking', 'manual'];

	var SAMPLE = {
		totals: { bookings: 50, nights: 142 },
		channels: {
			direct: { bookings: 12, nights: 34, revenue: 3120, share: 24 }, airbnb: { bookings: 21, nights: 58, revenue: 0, share: 42 },
			booking: { bookings: 15, nights: 44, revenue: 0, share: 30 }, manual: { bookings: 2, nights: 6, revenue: 0, share: 4 },
		},
		homes: [
			{ slug: 'easystay', name: 'EasyStay', bookings: 14, nights: 40, byChannel: { direct: 4, airbnb: 5, booking: 5, manual: 0 } },
			{ slug: 'luton-lodge', name: 'Luton Lodge', bookings: 12, nights: 36, byChannel: { direct: 3, airbnb: 5, booking: 3, manual: 1 } },
			{ slug: 'easystay-studio', name: 'EasyStay Studio', bookings: 10, nights: 26, byChannel: { direct: 2, airbnb: 5, booking: 3, manual: 0 } },
			{ slug: 'the-garden-nest', name: 'The Garden Nest', bookings: 9, nights: 25, byChannel: { direct: 2, airbnb: 4, booking: 2, manual: 1 } },
			{ slug: 'the-garden-studio', name: 'The Garden Studio', bookings: 5, nights: 15, byChannel: { direct: 1, airbnb: 2, booking: 2, manual: 0 } },
		],
		months: [{ month: '2026-09', direct: 3, airbnb: 6, booking: 5, manual: 0 }, { month: '2026-10', direct: 4, airbnb: 7, booking: 5, manual: 1 }, { month: '2026-11', direct: 5, airbnb: 8, booking: 5, manual: 1 }],
	};

	function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
	function table(head, rows) {
		var t = el('table', 'x-table'), tr = el('tr');
		head.forEach(function (h) { var th = el('th', '', h); th.scope = 'col'; tr.append(th); });
		t.append(el('thead')); t.firstChild.append(tr);
		var tb = el('tbody');
		rows.forEach(function (r) { var row = el('tr'); r.forEach(function (c) { row.append(typeof c === 'string' || typeof c === 'number' ? el('td', '', c) : c); }); tb.append(row); });
		t.append(tb);
		var wrap = el('div', 'x-scroll'); wrap.append(t); return wrap;
	}
	function bar(share) { var td = el('td', 'x-barcell'), b = el('span', 'x-bar'); b.style.setProperty('--w', share + '%'); td.append(b, el('span', '', share + '%')); return td; }
	function gbp(n) { return n ? '£' + n.toLocaleString('en-GB') : '-'; }

	function render(r) {
		var out = $('rp-out'); out.textContent = '';
		var cards = el('ul', 'x-stats');
		ORDER.forEach(function (k) {
			var c = r.channels[k], li = el('li'), box = el('div', 'x-stat x-stat--static');
			box.append(el('strong', '', c.bookings), el('span', '', NAMES[k]));
			li.append(box); cards.append(li);
		});
		out.append(cards);
		out.append(el('h3', '', 'Where bookings came from'), table(['Source', 'Bookings', 'Nights', 'Share', 'Revenue'], ORDER.map(function (k) {
			var c = r.channels[k]; return [NAMES[k], c.bookings, c.nights, bar(c.share), k === 'direct' ? gbp(c.revenue) : 'Not reported'];
		})));
		out.append(el('p', 'note', 'Airbnb and Booking.com do not share what the guest paid in their calendar feeds, so revenue is shown for this website only.'));
		out.append(el('h3', '', 'By home'), table(['Home', 'Bookings', 'Nights', 'This website', 'Airbnb', 'Booking.com', 'By hand'], r.homes.map(function (h) {
			return [h.name, h.bookings, h.nights, h.byChannel.direct, h.byChannel.airbnb, h.byChannel.booking, h.byChannel.manual];
		})));
		out.append(el('h3', '', 'By month (check-in)'), r.months.length ? table(['Month', 'This website', 'Airbnb', 'Booking.com', 'By hand'], r.months.map(function (m) { return [m.month, m.direct, m.airbnb, m.booking, m.manual]; })) : el('p', 'note', 'No bookings in this range.'));
	}

	var meta = document.querySelector('meta[name="lh-api"]');
	var api = $('rp-api'), token = $('rp-token'), mode = $('rp-mode');
	api.value = (meta && meta.content) || '';
	try { token.value = sessionStorage.getItem('lh-admin-token') || ''; } catch (e) { /* the token is just not remembered */ }

	function call(path, opts) {
		var base = api.value.trim().replace(/\/$/, '');
		if (!base || !token.value) return Promise.reject(new Error('Enter the API address and the admin token first.'));
		opts = opts || {}; opts.headers = { authorization: 'Bearer ' + token.value };
		return fetch(base + path, opts).then(function (res) {
			if (res.status === 401) throw new Error('Your sign-in ended or was not accepted. Sign out and sign in again.');
			if (!res.ok) throw new Error('The API answered ' + res.status + '.');
			return res;
		});
	}
	function query() {
		var p = new URLSearchParams();
		if ($('rp-from').value) p.set('from', $('rp-from').value);
		if ($('rp-to').value) p.set('to', $('rp-to').value);
		return p;
	}
	function say(msg, bad) { mode.textContent = msg; mode.classList.toggle('x-bad', !!bad); }

	$('rp-load').addEventListener('click', function () {
		try { sessionStorage.setItem('lh-admin-token', token.value); } catch (e) { /* not remembered */ }
		call('/api/admin/report?' + query()).then(function (r) { return r.json(); }).then(function (r) { render(r); say('Live figures from the API.'); loadSync(); loadBookings(); })
			.catch(function (e) { say(e.message || 'Could not reach the API.', true); });
	});
	$('rp-csv').addEventListener('click', function () {
		var p = query(); p.set('format', 'csv');
		call('/api/admin/report?' + p).then(function (r) { return r.blob(); }).then(function (b) {
			var a = el('a'); a.href = URL.createObjectURL(b); a.download = 'luton-homes-report.csv'; a.click(); URL.revokeObjectURL(a.href);
		}).catch(function (e) { say(e.message || 'Could not reach the API.', true); });
	});

	function loadSync() {
		call('/api/admin/sync-status').then(function (r) { return r.json(); }).then(function (rows) {
			var box = $('rp-sync'); box.textContent = '';
			box.append(table(['Home', 'Site', 'Feed', 'Last check'], rows.map(function (s) {
				return [s.home, s.channel === 'airbnb' ? 'Airbnb' : 'Booking.com', !s.configured ? 'Not connected' : s.last && s.last.ok ? s.last.count + ' stays' : s.last ? 'Failed: ' + s.last.error : 'Waiting', s.last ? new Date(s.last.at).toLocaleString('en-GB') : '-'];
			})));
		}).catch(function () { /* the report message already explains */ });
	}
	$('rp-sync-now').addEventListener('click', function () {
		say('Checking Airbnb and Booking.com now...');
		call('/api/admin/sync', { method: 'POST' }).then(function () { say('Calendars checked.'); loadSync(); }).catch(function (e) { say(e.message, true); });
	});

	// Website requests that are still waiting for payment or approval, each with Confirm and Cancel.
	function loadBookings() {
		call('/api/admin/bookings').then(function (r) { return r.json(); }).then(function (all) {
			var box = $('rp-bookings'), now = Date.now();
			var open = all.filter(function (b) { return b.channel === 'direct' && b.status === 'pending' && (b.paidConflict || Date.parse(b.holdUntil) > now); });
			box.textContent = '';
			if (!open.length) return box.append(el('p', 'note', 'No requests are waiting.'));
			box.append(table(['Guest', 'Home', 'Dates', 'Total', ''], open.map(function (b) {
				var td = el('td'), act = function (what) {
					var btn = el('button', 'button button--quiet', what === 'confirm' ? 'Confirm' : 'Cancel'); btn.type = 'button';
					btn.addEventListener('click', function () {
						call('/api/admin/bookings/' + encodeURIComponent(b.id) + '/' + what, { method: 'POST' }).then(loadBookings).catch(function (e) { say(e.message, true); });
					});
					return btn;
				};
				td.append(act('confirm'), act('cancel'));
				return [b.guest + ' (' + b.email + ')', b.home, b.from + ' to ' + b.to, gbp(b.total), td];
			})));
		}).catch(function () { /* the report message already explains */ });
	}

	render(SAMPLE);
	if (api.value && token.value) $('rp-load').click(); // signed in through the server: load the live figures straight away
})();
