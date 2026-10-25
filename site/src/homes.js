// Homes list filter and the gallery lightbox. Loaded only on /homes/ and home pages.
(() => {
	const $ = (id) => document.getElementById(id);
	// Homes filter: chips show and hide cards, the count is announced politely, the change morphs when supported.
	const list = $('home-list');
	if (list) {
		const items = [...list.children];
		const chips = [...document.querySelectorAll('[data-tag]')];
		document.querySelector('.filters').addEventListener('click', (e) => {
			const chip = e.target.closest('[data-tag]');
			if (!chip) return;
			const tag = chip.dataset.tag;
			const run = () => {
				const shown = items.filter((li) => {
					li.hidden = tag !== 'all' && !li.dataset.tags.includes('|' + tag + '|');
					return !li.hidden;
				});
				list.classList.toggle('is-filtered', tag !== 'all');
				chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
				$('filter-count').textContent = shown.length + (shown.length === 1 ? ' home' : ' homes');
			};
			if (document.startViewTransition) document.startViewTransition(run);
			else run();
		});
	}

	// Gallery lightbox: native dialog, arrows, swipe, focus back on the opened photo.
	const lb = $('lightbox');
	if (lb) {
		const opens = [...document.querySelectorAll('[data-open]')];
		const shot = lb.querySelector('img');
		let at = 0;
		let opener = null;
		let x0 = null;
		const show = (i) => {
			at = (i + opens.length) % opens.length;
			const img = opens[at].querySelector('img');
			shot.src = img.getAttribute('src');
			shot.alt = img.alt;
			$('lightbox-caption').textContent = img.alt;
			$('lightbox-count').textContent = at + 1 + ' of ' + opens.length;
		};
		opens.forEach((b, i) => b.addEventListener('click', () => { opener = b; show(i); lb.showModal(); }));
		lb.addEventListener('click', (e) => {
			const act = e.target.closest('[data-lb]')?.dataset.lb;
			if (act === 'close') lb.close();
			else if (act) show(at + (act === 'next' ? 1 : -1));
		});
		lb.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') show(at + (e.key === 'ArrowRight' ? 1 : -1));
		});
		lb.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
		lb.addEventListener('pointerup', (e) => {
			const dx = x0 === null ? 0 : e.clientX - x0;
			x0 = null;
			if (Math.abs(dx) >= 40) show(at + (dx < 0 ? 1 : -1));
		});
		lb.addEventListener('close', () => opener?.focus());
	}
})();
