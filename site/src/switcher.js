// Design preview switcher, every page. Choosing a design saves it, writes ?design= to the URL and reloads the home page.
(function () {
	var root = document.documentElement;
	var wrap = document.querySelector('[data-switcher]');
	if (!wrap) return;
	var button = wrap.querySelector('.design-switcher-button');
	var menu = wrap.querySelector('.design-switcher-menu');
	var items = [].slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
	var labels = { sky: 'Design: Sky', dawn: 'Design: Night to dawn', orbit: 'Design: Orbit' };
	var current = function () { return root.dataset.design || 'sky'; };

	function sync() {
		button.textContent = labels[current()];
		items.forEach(function (item) { item.setAttribute('aria-checked', String(item.dataset.designValue === current())); });
	}
	function setOpen(open) {
		menu.hidden = !open;
		button.setAttribute('aria-expanded', String(open));
	}
	function focusItem(i) { items[(i + items.length) % items.length].focus(); }
	function choose(value) {
		try { localStorage.setItem('lh-design', value); } catch (e) { /* private mode: the URL still carries the choice */ }
		var url = new URL(location.href);
		url.searchParams.set('design', value);
		if (location.pathname === '/') return location.replace(url.href);
		history.replaceState(null, '', url.href);
		root.dataset.design = value;
		sync();
		setOpen(false);
		button.focus();
	}

	button.addEventListener('click', function () {
		var open = menu.hidden;
		setOpen(open);
		if (open) items[Math.max(0, items.findIndex(function (x) { return x.getAttribute('aria-checked') === 'true'; }))].focus();
	});
	menu.addEventListener('click', function (e) {
		var item = e.target.closest('[role="menuitemradio"]');
		if (item) choose(item.dataset.designValue);
	});
	wrap.addEventListener('keydown', function (e) {
		var i = items.indexOf(document.activeElement);
		if (e.key === 'Escape') { setOpen(false); button.focus(); return; }
		if (i < 0) return;
		if (e.key === 'ArrowDown') focusItem(i + 1);
		else if (e.key === 'ArrowUp') focusItem(i - 1);
		else if (e.key === 'Home') focusItem(0);
		else if (e.key === 'End') focusItem(items.length - 1);
		else return;
		e.preventDefault();
	});
	wrap.addEventListener('focusout', function (e) {
		if (!wrap.contains(e.relatedTarget)) setOpen(false);
	});
	sync();
})();
