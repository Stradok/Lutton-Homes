// Custom 3: the cloud-and-plane intro on the home page. The CSS runs the flight while <html> has c3-pending
// (set before first paint, once per session, never under reduced motion); this script ends it on time,
// lets Skip intro or Escape end it early, and remembers that it played.
(function () {
	var root = document.documentElement;
	var intro = document.querySelector('[data-c3-intro]');
	if (!intro || !root.classList.contains('c3-pending')) return;
	try { sessionStorage.setItem('lh-c3-seen', '1'); } catch (e) { /* the intro may play again in a new tab */ }

	var done = false;
	function finish() {
		if (done) return;
		done = true;
		root.classList.remove('c3-pending');
		root.classList.add('c3-done');
		document.removeEventListener('keydown', onKey);
		var main = document.getElementById('content');
		if (intro.contains(document.activeElement) && main) main.focus({ preventScroll: true });
	}
	function onKey(e) { if (e.key === 'Escape') finish(); }

	root.classList.add('c3-fly');
	intro.querySelector('[data-c3-skip]').addEventListener('click', finish);
	document.addEventListener('keydown', onKey);
	// The flight and the parting clouds take 3.2s in the CSS.
	setTimeout(finish, 3300);
})();

// Photo tour dialog: tiles and the "Show all photos" button open it (at a room, or at the top); room chips jump to a room.
(function () {
	var dlg = document.getElementById('tour-dialog');
	if (!dlg || !dlg.showModal) return;
	var root = document.documentElement;
	document.addEventListener('click', function (e) {
		var open = e.target.closest('[data-tour-open]');
		if (open) {
			e.preventDefault();
			dlg.showModal();
			root.classList.add('c3-lock');
			var room = open.getAttribute('data-tour-open'), sec = room && dlg.querySelector('#tour-' + room);
			if (sec) sec.scrollIntoView(); else dlg.querySelector('.c3-tour-body').scrollTop = 0;
			return;
		}
		var chip = dlg.contains(e.target) && e.target.closest('.c3-tour-bar a');
		if (chip) { e.preventDefault(); dlg.querySelector('#tour-' + chip.getAttribute('data-room')).scrollIntoView(); return; }
		if (e.target.closest('[data-tour-close]')) dlg.close();
	});
	dlg.addEventListener('close', function () { root.classList.remove('c3-lock'); });
})();

// Day and night: swap in the AI night photos (data-night) and label the toggle. The page already carries data-theme
// from the head script (visitor's local time, or their saved choice); the toggle saves a choice.
(function () {
	var root = document.documentElement, btn = document.querySelector('[data-theme-toggle]');
	function swap(night) {
		[].forEach.call(document.querySelectorAll('img[data-night]'), function (img) {
			if (img.dataset.daySrc === undefined) { img.dataset.daySrc = img.getAttribute('src'); img.dataset.daySrcset = img.getAttribute('srcset') || ''; }
			var n = img.dataset.night, s = n.replace('-1600.webp', '-800.webp');
			if (!night) { img.setAttribute('src', img.dataset.daySrc); if (img.dataset.daySrcset) img.setAttribute('srcset', img.dataset.daySrcset); return; }
			if (img.dataset.daySrcset) { img.setAttribute('srcset', s + ' 800w, ' + n + ' 1600w'); img.setAttribute('src', n); } else img.setAttribute('src', /-800\.webp$/.test(img.dataset.daySrc) ? s : n);
		});
	}
	function paint() {
		var night = root.getAttribute('data-theme') === 'night';
		swap(night);
		if (btn) {
			btn.setAttribute('aria-pressed', String(night));
			btn.setAttribute('aria-label', night ? 'Switch to day mode' : 'Switch to night mode');
			btn.querySelector('.c3-theme-label').textContent = night ? 'Day' : 'Night';
		}
	}
	if (btn) btn.addEventListener('click', function () {
		var next = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
		root.setAttribute('data-theme', next);
		try { localStorage.setItem('lh-theme', next); } catch (e) { /* the choice just will not be remembered */ }
		paint();
	});
	paint();
})();
