// Design switcher, every page. Each option is a link to the same page in another design (works without JavaScript).
// This script adds the menu behaviour and carries the current query (dates, guests) across designs.
(function () {
	var wrap = document.querySelector('[data-switcher]');
	if (!wrap) return;
	var button = wrap.querySelector('.design-switcher-button');
	var menu = wrap.querySelector('.design-switcher-menu');
	var items = [].slice.call(menu.querySelectorAll('[role="menuitemradio"]'));

	function setOpen(open) {
		menu.hidden = !open;
		button.setAttribute('aria-expanded', String(open));
	}
	function focusItem(i) { items[(i + items.length) % items.length].focus(); }

	button.addEventListener('click', function () {
		var open = menu.hidden;
		setOpen(open);
		if (open) items[Math.max(0, items.findIndex(function (x) { return x.getAttribute('aria-checked') === 'true'; }))].focus();
	});
	menu.addEventListener('click', function (e) {
		var item = e.target.closest('[role="menuitemradio"]');
		if (!item) return;
		// Choosing Sky always replays its intro.
		if (item.dataset.designValue === 'sky') try { sessionStorage.removeItem('lh-dawn-seen'); } catch (err) { /* intro may be skipped */ }
		if (location.search) { e.preventDefault(); location.href = item.getAttribute('href') + location.search; }
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
})();
