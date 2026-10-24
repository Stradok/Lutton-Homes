// Builds the WhatsApp availability link from the home page search card. No dependencies.
// Loaded with defer on the front page only. Without JavaScript the form submits to the plain wa.me link.

const LH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LH_DATE_ERROR = 'Choose a check-out date after your check-in date.';
const LH_GUESTS_ERROR = 'Enter a whole number of guests, 1 or more.';

function lhIsDate(value) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const date = new Date(value + 'T00:00:00Z');
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Input is a validated YYYY-MM-DD string. Returns "12 Nov 2026"; the month names are fixed so the output does not depend on ICU.
function lhFormatDate(value) {
	const [year, month, day] = value.split('-');
	return Number(day) + ' ' + LH_MONTHS[Number(month) - 1] + ' ' + year;
}

// Accepts a number, or a digit string with optional surrounding spaces. Exponents, decimals and blanks give null.
function lhParseGuests(value) {
	let n;
	if (typeof value === 'number') {
		n = value;
	} else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
		n = Number(value.trim());
	} else {
		return null;
	}
	return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

function buildWhatsAppUrl(number, checkin, checkout, guests) {
	const n = lhParseGuests(guests);
	if (n === null || !lhIsDate(checkin) || !lhIsDate(checkout) || checkout <= checkin) {
		return null;
	}
	const text = 'Hello Luton Homes, I would like to check availability from ' + lhFormatDate(checkin)
		+ ' to ' + lhFormatDate(checkout) + ' for ' + n + (n === 1 ? ' guest' : ' guests') + '.';
	return 'https://wa.me/' + number + '?text=' + encodeURIComponent(text);
}

if (typeof document !== 'undefined') {
	const form = document.getElementById('lh-search');
	if (form) {
		const checkin = document.getElementById('lh-checkin');
		const checkout = document.getElementById('lh-checkout');
		const guests = document.getElementById('lh-guests');
		const error = document.getElementById('lh-search-error');

		checkin.addEventListener('change', () => {
			checkout.min = checkin.value;
		});

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			error.textContent = '';
			if (lhParseGuests(guests.value) === null) {
				error.textContent = LH_GUESTS_ERROR;
				return;
			}
			const url = buildWhatsAppUrl(form.dataset.whatsappNumber, checkin.value, checkout.value, guests.value);
			if (url === null) {
				error.textContent = LH_DATE_ERROR;
				return;
			}
			// Do not pass 'noopener' to window.open: with that feature it always returns null, which would look like a blocked popup.
			const win = window.open(url, '_blank');
			if (win) {
				win.opener = null;
			} else {
				window.location.href = url;
			}
		});
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { buildWhatsAppUrl };
}
