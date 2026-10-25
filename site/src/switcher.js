// Design switcher, every page. A choice applies at once on inner pages; the home page reloads so its intro plays.
(function () {
	var root = document.documentElement;
	var wrap = document.querySelector('[data-switcher]');
	if (!wrap) return;
	var button = wrap.querySelector('.design-switcher-button');
	var text = wrap.querySelector('.design-switcher-text');
	var menu = wrap.querySelector('.design-switcher-menu');
	var items = [].slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
	var names = { original: 'Original', sky: 'Sky', dawn: 'Night to dawn', orbit: 'Orbit' };
	var current = function () { return root.dataset.design || 'original'; };

	function sync() {
		text.textContent = 'Design: ' + names[current()];
		items.forEach(function (item) { item.setAttribute('aria-checked', String(item.dataset.designValue === current())); });
	}
	function setOpen(open) {
		menu.hidden = !open;
		button.setAttribute('aria-expanded', String(open));
	}
	function focusItem(i) { items[(i + items.length) % items.length].focus(); }
	function choose(value) {
		try {
			localStorage.setItem('lh-design', value);
			if (value === 'dawn') sessionStorage.removeItem('lh-dawn-seen');
		} catch (e) { /* private mode: the URL still carries the choice */ }
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

	// One attention pulse on the first visit. Skipped under reduced motion; the flag is saved only when the pulse runs.
	try {
		if (!localStorage.getItem('lh-design-seen') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
			wrap.classList.add('is-pulse');
			localStorage.setItem('lh-design-seen', '1');
		}
	} catch (e) { /* no storage: no pulse */ }
	sync();
})();
