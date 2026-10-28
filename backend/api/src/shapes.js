// Shared constants and shapes. Every module imports from here so the pieces stay interchangeable.
//
// Block: one stay (or one blocked range) on one home.
//   { id: string, home: string (home slug), from: 'YYYY-MM-DD' (check-in night),
//     to: 'YYYY-MM-DD' (check-out day, exclusive), channel: Channel, status: Status,
//     guest?: string, email?: string, holdUntil?: string (ISO 8601, pending only), payment?: string (provider reference), total?: number (GBP, direct bookings only), createdAt: string (ISO 8601) }
// A block covers the nights from `from` up to but not including `to`. A guest can check in on the day another checks out.

export const CHANNELS = ['direct', 'airbnb', 'booking', 'manual'];
// pending = a direct booking waiting for payment or owner approval; it holds its nights only until holdUntil.
export const STATUSES = ['pending', 'confirmed', 'cancelled'];
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Days since 1970-01-01 for an ISO date (UTC, so no daylight-saving drift), and back.
export const dayNumber = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 864e5);
export const isoFromDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
// Date.parse is NaN for impossible dates such as 2026-13-40; checking first keeps isoFromDay from throwing on them.
export const isIsoDate = (s) => typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && isoFromDay(dayNumber(s)) === s;
