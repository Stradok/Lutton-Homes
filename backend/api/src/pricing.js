// Sample price rules, the same ones the website shows (site/src/quote.js). Real fees come from the owners.
export const CLEANING = 35;
export const WEEK_DISCOUNT = 0.1; // off the stay from 7 nights

export function quote(rate, nights) {
	const stay = rate * nights;
	const discount = nights >= 7 ? Math.round(stay * WEEK_DISCOUNT) : 0;
	return { stay, cleaning: CLEANING, discount, total: stay + CLEANING - discount };
}
