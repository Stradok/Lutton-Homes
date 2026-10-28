// Payment slot. A provider turns a pending booking into a pay-now link and later tells us it was paid.
//
//   provider = {
//     name: 'stripe',
//     // Return { url } to send the guest to the provider's checkout page, or null when there is nothing to pay online.
//     createCheckout: async ({ booking, home, successUrl, cancelUrl }) => ({ url, ref }),
//     // Check the signature on the provider's webhook and return { bookingId, paid: true|false }, or null to ignore it.
//     parseWebhook: async ({ headers, raw }) => ({ bookingId, paid }),
//   }
//
// To add Stripe, PayPal or Square: write that object in its own file, register it below, set PAYMENT_PROVIDER, and point the
// provider's webhook at POST /api/payments/webhook/<name>. Nothing else in the API changes.

// Default: no online payment. The booking stays pending until the owner confirms it from the dashboard.
const manual = { name: 'manual', createCheckout: async () => null, parseWebhook: async () => null };

const providers = new Map([[manual.name, manual]]);

export const registerProvider = (provider) => providers.set(provider.name, provider);

export function getProvider(name = 'manual') {
	const p = providers.get(name);
	if (!p) throw new Error(`Unknown PAYMENT_PROVIDER "${name}". Registered: ${[...providers.keys()].join(', ')}`);
	return p;
}
