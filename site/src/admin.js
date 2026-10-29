// Owner preview scripts: sign in, sign out, the review-link maker and the add-property form.
// With an API address (the lh-api meta tag) sign-in is checked by the server, which returns a 12 hour session token.
// Without one it is a design-preview gate only: this is a static site, so it protects nothing.
(function () {
	var P = window.LH_PREVIEW || {}, KEY = 'lh-admin';
	function $(id) { return document.getElementById(id); }

	var login = $('login-form');
	var meta = document.querySelector('meta[name="lh-api"]'), api = meta && meta.content.replace(/\/$/, '');
	function enter(token) {
		try { sessionStorage.setItem(KEY, '1'); if (token) sessionStorage.setItem('lh-admin-token', token); } catch (x) { /* the dashboard cannot open without it */ }
		location.href = new URL('../', location.href).pathname;
	}
	if (login) login.addEventListener('submit', function (e) {
		e.preventDefault();
		var user = login.elements.user.value.trim(), pass = login.elements.pass.value, err = $('lg-error');
		if (!api) return P.user && user === P.user && pass === P.pass ? enter() : (err.textContent = 'That username or password is not right.');
		fetch(api + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: user, password: pass }) })
			.then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
			.then(function (r) { if (r.ok) enter(r.j.token); else err.textContent = r.j.error || 'Sign in failed.'; })
			.catch(function () { err.textContent = 'Could not reach the server. Try again.'; });
	});

	var out = $('x-signout');
	if (out) out.addEventListener('click', function () {
		try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('lh-admin-token'); } catch (x) { /* nothing to clear */ }
		location.href = out.dataset.to;
	});

	// Expandable stat cards and calendar cells.
	document.querySelectorAll('.x-stat').forEach(function (b) {
		b.addEventListener('click', function () { var o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(o)); $(b.getAttribute('aria-controls')).hidden = !o; });
	});
	var info = $('x-cellinfo');
	document.querySelectorAll('.x-cell').forEach(function (c) { c.addEventListener('click', function () { info.textContent = c.dataset.info; }); });

	// Review link: a link for one stay that opens the 1, 3 or 5 star page for that home.
	var rl = $('rl-home');
	if (rl) {
		var link = $('rl-link'), base = new URL($('rl-base').getAttribute('href'), location.href);
		var make = function () {
			var u = new URL(base); u.searchParams.set('home', rl.value); if (base.searchParams.get('t')) u.searchParams.set('t', base.searchParams.get('t'));
			if ($('rl-ref').value.trim()) u.searchParams.set('ref', $('rl-ref').value.trim());
			link.value = u.href;
			$('rl-wa').href = 'https://wa.me/?text=' + encodeURIComponent('Thank you for staying with Luton Homes. Tell us how it went in one tap: ' + u.href);
		};
		var tok = function () { try { return sessionStorage.getItem('lh-admin-token'); } catch (x) { return null; } };
		var withToken = function () {
			if (!api || !tok()) return;
			fetch(api + '/api/admin/review-links', { method: 'POST', headers: { authorization: 'Bearer ' + tok(), 'content-type': 'application/json' }, body: JSON.stringify({ home: rl.value, ref: $('rl-ref').value.trim() }) })
				.then(function (r) { return r.json(); }).then(function (j) { if (j.token) { base.searchParams.set('t', j.token); make(); } });
		};
		rl.addEventListener('input', function () { make(); withToken(); }); $('rl-ref').addEventListener('change', withToken); make(); withToken();
		$('rl-copy').addEventListener('click', function () {
			link.select();
			var ok = function () { $('rl-ok').textContent = 'Link copied.'; };
			if (navigator.clipboard) navigator.clipboard.writeText(link.value).then(ok, function () { document.execCommand('copy'); ok(); });
			else { document.execCommand('copy'); ok(); }
		});
	}

	// Add property: one photo row per room, each with an optional night photo. Previews use local object URLs only.
	var rooms = $('p-rooms');
	if (rooms) {
		var cat = $('p-cat');
		cat.addEventListener('change', function () { $('p-custom-wrap').hidden = cat.value !== 'custom'; });
		var thumb = function (input, box) {
			var f = input.files[0]; box.textContent = '';
			if (!f) return;
			var img = document.createElement('img'); img.alt = 'Preview of ' + f.name; img.src = URL.createObjectURL(f); box.append(img);
		};
		var draw = function () {
			rooms.textContent = '';
			document.querySelectorAll('#p-counts input').forEach(function (inp) {
				var n = Math.max(0, Math.min(+inp.max, parseInt(inp.value, 10) || 0));
				for (var i = 1; i <= n; i++) {
					var id = 'ph-' + inp.id + '-' + i, row = document.createElement('div'); row.className = 'x-room';
					row.innerHTML = '<p class="x-room-name"></p><div class="field"><label for="' + id + '-d">Day photo</label><input id="' + id + '-d" type="file" accept="image/*"><div class="x-thumb"></div></div>'
						+ '<div class="field"><label for="' + id + '-n">Night photo (optional)</label><input id="' + id + '-n" type="file" accept="image/*"><div class="x-thumb"></div></div>';
					row.dataset.room = inp.dataset.room; row.firstChild.textContent = inp.dataset.room + (n > 1 ? ' ' + i : '');
					row.querySelectorAll('input').forEach(function (fi) { fi.addEventListener('change', function () { thumb(fi, fi.nextElementSibling); }); });
					rooms.append(row);
				}
			});
		};
		$('p-counts').addEventListener('input', draw); draw();
		var token = function () { try { return sessionStorage.getItem('lh-admin-token'); } catch (x) { return null; } };
		var call = function (path, opts) {
			opts = opts || {}; opts.headers = Object.assign({ authorization: 'Bearer ' + token() }, opts.headers);
			return fetch(api + path, opts).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'The server answered ' + r.status); return j; }); });
		};
		var live = api && token();
		if (live) { $('p-mode').textContent = 'Saved to the live server. Press Publish on the dashboard to show it on the website.'; $('p-savetxt').textContent = 'Save property'; }
		var up = function (input) { var f = input.files[0]; return f ? call('/api/admin/uploads', { method: 'POST', body: f }).then(function (j) { return j.url; }) : Promise.resolve(''); };
		var save = function () {
			var d = $('p-done'), list = [].slice.call(rooms.children), cat = $('p-cat');
			d.hidden = false; d.textContent = 'Uploading photos...';
			var work = list.reduce(function (p, row) {
				return p.then(function (all) {
					var f = row.querySelectorAll('input');
					return up(f[0]).then(function (day) { return up(f[1]).then(function (night) { if (day) all.push({ type: row.dataset.room, photos: [{ day: day, night: night || undefined, alt: row.dataset.room }] }); return all; }); });
				});
			}, Promise.resolve([]));
			return work.then(function (r) {
				var beds = +$('n-bedroom').value || 0;
				return call('/api/admin/homes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
					name: $('p-name').value, category: cat.value === 'custom' ? $('p-custom').value : cat.value, address: $('p-addr').value, rate: +$('p-rate').value, sleeps: +$('p-sleeps').value,
					summary: $('p-summary').value, beds: beds + (beds === 1 ? ' bedroom' : ' bedrooms'), amenities: $('p-amen').value.split(','), rooms: r }) });
			}).then(function (h) { d.textContent = h.name + ' was saved. Press Publish on the dashboard to show it on the website.'; })
				.catch(function (e) { d.textContent = 'Not saved: ' + e.message; });
		};
		$('p-save').addEventListener('click', function () {
			if (live) return save();
			var c = cat.value === 'custom' ? $('p-custom').value.trim() || 'Other' : cat.options[cat.selectedIndex].text, d = $('p-done');
			d.hidden = false;
			d.textContent = ($('p-name').value.trim() || 'This property') + ' would be listed under ' + c + ' with ' + rooms.children.length + ' room photo slots. Preview only: nothing was saved.';
		});
	}
})();
