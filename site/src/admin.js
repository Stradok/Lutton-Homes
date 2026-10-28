// Owner preview scripts: sign in, sign out, the review-link maker and the add-property form.
// With an API address (the lh-api meta tag) sign-in is checked by the server, which returns a 12 hour session token.
// Without one it is a design-preview gate only: this is a static site, so it protects nothing.
(function () {
	var USER = 'admin', PASS = 'zamooq121', KEY = 'lh-admin';
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
		if (!api) return user === USER && pass === PASS ? enter() : (err.textContent = 'That username or password is not right.');
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
			var u = new URL(base); u.searchParams.set('home', rl.value);
			if ($('rl-ref').value.trim()) u.searchParams.set('ref', $('rl-ref').value.trim());
			link.value = u.href;
			$('rl-wa').href = 'https://wa.me/?text=' + encodeURIComponent('Thank you for staying with Luton Homes. Tell us how it went in one tap: ' + u.href);
		};
		rl.addEventListener('input', make); $('rl-ref').addEventListener('input', make); make();
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
					row.firstChild.textContent = inp.dataset.room + (n > 1 ? ' ' + i : '');
					row.querySelectorAll('input').forEach(function (fi) { fi.addEventListener('change', function () { thumb(fi, fi.nextElementSibling); }); });
					rooms.append(row);
				}
			});
		};
		$('p-counts').addEventListener('input', draw); draw();
		$('p-save').addEventListener('click', function () {
			var c = cat.value === 'custom' ? $('p-custom').value.trim() || 'Other' : cat.options[cat.selectedIndex].text, d = $('p-done');
			d.hidden = false;
			d.textContent = ($('p-name').value.trim() || 'This property') + ' would be listed under ' + c + ' with ' + rooms.children.length + ' room photo slots. Preview only: nothing was saved.';
		});
	}
})();
