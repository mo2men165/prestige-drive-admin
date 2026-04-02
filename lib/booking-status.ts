import { doc, updateDoc, type Firestore } from 'firebase/firestore';
import type { BookingData, BookingStatus, BookingType } from '@/lib/booking-types';
import { BOOKING_STATUSES } from '@/lib/booking-types';

const VALID_KEYS = new Set(BOOKING_STATUSES.map((s) => s.key));

/** Map legacy Firestore values to the current lifecycle. */
const LEGACY_STATUS_MAP: Record<string, BookingStatus> = {
  confirmed: 'booked',
  pending_payment: 'awaiting_payment',
  no_show: 'cancelled',
};

export function normalizeBookingStatus(raw: unknown): BookingStatus {
  if (typeof raw !== 'string' || !raw) return 'booked';
  if (LEGACY_STATUS_MAP[raw]) return LEGACY_STATUS_MAP[raw];
  if (VALID_KEYS.has(raw as BookingStatus)) return raw as BookingStatus;
  return 'booked';
}

function parseDateStart(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = dateStr.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function applyTime(d: Date, timeStr: string | undefined, endOfDayIfMissing: boolean): Date {
  const next = new Date(d.getTime());
  if (timeStr && /^\d{1,2}:\d{2}/.test(timeStr.trim())) {
    const [h, m] = timeStr.trim().split(':').map((x) => parseInt(x, 10));
    next.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  } else if (endOfDayIfMissing) {
    next.setHours(23, 59, 59, 999);
  } else {
    next.setHours(0, 0, 0, 0);
  }
  return next;
}

function pickupStartMs(booking: BookingData): number | null {
  const base = parseDateStart(booking.pickupDate);
  if (!base) return null;
  return applyTime(base, booking.pickupTime, false).getTime();
}

function dropoffEndMs(booking: BookingData): number | null {
  const base = parseDateStart(booking.dropoffDate);
  if (!base) return null;
  return applyTime(base, booking.dropoffTime, true).getTime();
}

/**
 * Returns the next status if automation applies, otherwise null.
 * Upcoming → in_progress when now >= pickup (start of pickup day, or pickup time if set).
 * In progress → completed when now >= dropoff (dropoff time if set, else end of dropoff day).
 */
export function computeAutoAdvanceStatus(booking: BookingData, nowMs: number): BookingStatus | null {
  const { status } = booking;
  if (
    status === 'cancelled' ||
    status === 'cancelled_refunded' ||
    status === 'booked' ||
    status === 'awaiting_payment' ||
    status === 'completed'
  ) {
    return null;
  }

  if (status === 'upcoming') {
    const start = pickupStartMs(booking);
    if (start != null && nowMs >= start) return 'in_progress';
  }

  if (status === 'in_progress') {
    const end = dropoffEndMs(booking);
    if (end != null && nowMs >= end) return 'completed';
  }

  return null;
}

export function normalizeBookingDoc(
  id: string,
  raw: Record<string, unknown>,
): BookingData {
  const bookingType = (raw.bookingType as BookingType) || 'standard';
  return {
    ...raw,
    id,
    bookingType,
    status: normalizeBookingStatus(raw.status),
    adminNotes: (raw.adminNotes as string) || '',
    additionalNotes: (raw.additionalNotes as string) || '',
  } as BookingData;
}

/** Persist automatic status advances (upcoming → in progress → completed). */
export async function syncAutoBookingStatuses(
  db: Firestore,
  bookings: BookingData[],
): Promise<BookingData[]> {
  const now = Date.now();
  const updates: { id: string; next: BookingStatus }[] = [];
  for (const b of bookings) {
    const next = computeAutoAdvanceStatus(b, now);
    if (next) updates.push({ id: b.id, next });
  }
  if (updates.length === 0) return bookings;

  const ts = new Date().toISOString();
  await Promise.all(
    updates.map(({ id, next }) =>
      updateDoc(doc(db, 'bookings', id), { status: next, lastUpdated: ts }),
    ),
  );

  const map = new Map(updates.map((u) => [u.id, u.next]));
  return bookings.map((b) =>
    map.has(b.id) ? { ...b, status: map.get(b.id)!, lastUpdated: ts } : b,
  );
}
