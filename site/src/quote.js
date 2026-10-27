// Sample price breakdown shared by the booking panel and the booking pages. The fee and discount are placeholders until the owners confirm them.
const LH_CLEANING = 35;
function lhQuote(rate, nights) {
	const stay = rate * nights;
	const discount = nights >= 7 ? Math.round(stay * 0.1) : 0;
	return { stay, cleaning: LH_CLEANING, discount, total: stay + LH_CLEANING - discount };
}
