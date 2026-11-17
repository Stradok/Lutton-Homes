// Sign in with Google or an emailed code, for owners (/admin/login/) and guests (/account/). Needs the API (the lh-api meta tag).
// Google sends the browser back with the session in the address fragment, which is never sent to any server; it is stored and removed at once.
(function () {
	var root = document.getElementById('signin');
	if (!root) return;
	var mode = root.dataset.mode, meta = document.querySelector('meta[name="lh-api"]'), api = meta && meta.content.replace(/\/$/, '');
	var KEY = mode === 'owner' ? 'lh-admin-token' : 'lh-guest-token';
	function $(id) { return document.getElementById(id); }
	function say(text) { $('si-error').textContent = text || ''; }
	function get(path, token) { return fetch(api + path, { headers: token ? { authorization: 'Bearer ' + token } : {} }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }); }
	function post(path, body) { return fetch(api + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }); }
	function save(token) { try { sessionStorage.setItem(KEY, token); } catch (x) { /* sign-in cannot be kept */ } }

	// Owners go to the dashboard; guests see their bookings. A guest who signs in on the owner page is told, not let in.
	function finish(token) {
		get('/api/me', token).then(function (r) {
			if (!r.ok) return say('Sign in failed. Try again.');
			if (mode === 'owner') {
				if (r.j.role !== 'owner') return say('That account is not an owner account.');
				try { sessionStorage.setItem('lh-admin', '1'); } catch (x) { /* the dashboard cannot open without it */ }
				save(token); location.href = new URL('../', location.href).pathname;
			} else { save(token); showBookings(token, r.j.user); }
		}).catch(function () { say('Could not reach the server. Try again.'); });
	}

	function showBookings(token, email) {
		root.querySelector('.si-start').hidden = true; $('si-account').hidden = false; $('si-who').textContent = email;
		get('/api/my/bookings', token).then(function (r) {
			var list = $('si-list'); list.textContent = '';
			if (!r.ok || !r.j.length) { list.textContent = r.ok ? 'No bookings found for this email address.' : 'Could not load your bookings.'; return; }
			r.j.forEach(function (b) {
				var li = document.createElement('li');
				li.textContent = b.home.replace(/-/g, ' ') + ': ' + b.from + ' to ' + b.to + ', ' + b.status + (typeof b.total === 'number' ? ', £' + b.total : '');
				list.append(li);
			});
		});
	}

	if (!api) { say('Sign in is available once the live service is connected.'); root.querySelector('.si-start').hidden = true; return; }

	var h = new URLSearchParams(location.hash.slice(1));
	if (h.get('session') || h.get('signin_error')) history.replaceState(null, '', location.pathname + location.search);
	if (h.get('signin_error')) say('Google sign in did not finish. Try again.');
	var existing; try { existing = sessionStorage.getItem(KEY); } catch (x) { existing = null; }
	if (h.get('session')) finish(h.get('session')); else if (existing && mode === 'guest') finish(existing);

	get('/api/auth/methods').then(function (r) {
		if (r.j.google) { var g = $('si-google'); g.href = api + '/api/auth/google/start?return=' + encodeURIComponent(location.origin + location.pathname); g.hidden = false; }
		if (r.j.otp) $('si-otp').hidden = false;
		if (mode === 'owner' && !r.j.password) { var f = $('login-form'); if (f) f.hidden = true; }
	}).catch(function () { say('Could not reach the server. Try again.'); });

	var email, otp = $('si-otp');
	otp.addEventListener('submit', function (e) {
		e.preventDefault(); say('');
		if ($('si-code-row').hidden) {
			email = otp.elements.email.value.trim();
			post('/api/auth/otp/request', { email: email }).then(function (r) {
				if (!r.ok) return say(r.j.error || 'Could not send a code.');
				$('si-code-row').hidden = false; $('si-note').textContent = 'We emailed a 6 digit code to ' + email + '. It lasts 10 minutes.'; otp.elements.code.focus();
			}).catch(function () { say('Could not reach the server. Try again.'); });
		} else {
			post('/api/auth/otp/verify', { email: email, code: otp.elements.code.value.trim() }).then(function (r) {
				if (r.ok) finish(r.j.token); else say(r.j.error || 'That code is not right.');
			}).catch(function () { say('Could not reach the server. Try again.'); });
		}
	});

	var out = $('si-out');
	if (out) out.addEventListener('click', function () { try { sessionStorage.removeItem(KEY); } catch (x) { /* nothing to clear */ } location.reload(); });
})();
