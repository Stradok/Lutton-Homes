// Review link preview: one tap on 1, 3 or 5 stars writes the review text; the guest can edit it. Nothing is sent or stored.
(function () {
	var q = new URLSearchParams(location.search), homes = {}, s = '';
	try { homes = JSON.parse(document.getElementById('lh-homes').textContent); } catch (e) { /* no home names */ }
	var name = homes[q.get('home')] ? homes[q.get('home')].name : 'Luton Homes';
	var TEXT = {
		1: 'My stay at ' + name + ' was not good. I would like the team to put things right.',
		3: 'My stay at ' + name + ' was fine. Some things were good and some could be better.',
		5: 'I loved my stay at ' + name + '. Booking direct was easy and the home was a great base near Luton Airport.',
	};
	if (homes[q.get('home')]) document.getElementById('rv-for').textContent = 'Your stay at ' + name + '. Pick one option. We write the review for you, and you can change it.';
	var text = document.getElementById('rv-text'), post = document.getElementById('rv-post'), done = document.getElementById('rv-done');
	document.getElementById('rv-form').addEventListener('change', function (e) {
		if (e.target.name !== 'stars') return;
		s = e.target.value; text.value = TEXT[s]; post.disabled = false; done.hidden = true;
	});
	var api = (document.querySelector('meta[name="lh-api"]') || {}).content;
	post.addEventListener('click', function () {
		var n = +s, st = document.getElementById('rv-pstars');
		st.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
		st.setAttribute('aria-label', n + ' out of 5');
		document.getElementById('rv-ptext').textContent = '"' + text.value + '"';
		document.getElementById('rv-pby').textContent = 'A guest of ' + name + ' (sample)';
		// Copy the text and open Google; the guest pastes it and presses Google's Post button (a page cannot fill in another site's box).
		try { navigator.clipboard.writeText(text.value); } catch (e) { text.select(); document.execCommand('copy'); }
		window.open(document.getElementById('rv-google').href, '_blank', 'noopener');
		done.hidden = false; done.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		// With an API address the review is also sent to the website, where an owner publishes it.
		if (api) fetch(api.replace(/\/$/, '') + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: q.get('t'), stars: n, text: text.value }) })
			.then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); }); })
			.catch(function (e) { done.append(' Your review was not saved on our website: ' + e.message); });
	});
})();
