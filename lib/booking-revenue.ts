import type { BookingData, BookingStatus } from '@/lib/booking-types';
import { PAID_REVENUE_STATUSES } from '@/lib/booking-types';

export function bookingMonetaryTotal(b: BookingData): number {
  const n = Number(b.totalPrice);
  return Number.isFinite(n) ? n : 0;
}

export interface RevenueMetrics {
  /** Sum of totals for bookings currently in the paid pipeline (upcoming, in progress, completed). This is recognized revenue. */
  grossPaid: number;
  /** Sum of totals for bookings in cancelled_refunded — informational only (already excluded from grossPaid). */
  refunded: number;
  /** Same as grossPaid. Refunds are not subtracted here: leaving the paid pipeline already removes that booking from revenue. */
  net: number;
}

/**
 * Recognized revenue = sum of `totalPrice` only for bookings in upcoming, in progress, or completed.
 * Cancelled and cancelled_refunded exclude the booking from that sum, so revenue returns to 0 when
 * a paid booking is cancelled — no second subtraction (which incorrectly produced negative net).
 */
export function computeRevenueMetrics(bookings: BookingData[]): RevenueMetrics {
  const pipeline = bookings
    .filter((b) => PAID_REVENUE_STATUSES.includes(b.status as BookingStatus))
    .reduce((sum, b) => sum + bookingMonetaryTotal(b), 0);

  const refunded = bookings
    .filter((b) => b.status === 'cancelled_refunded')
    .reduce((sum, b) => sum + bookingMonetaryTotal(b), 0);

  return {
    grossPaid: pipeline,
    refunded,
    net: pipeline,
  };
}
