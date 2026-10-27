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
