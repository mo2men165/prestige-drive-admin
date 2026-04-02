export type BookingType = 'standard' | 'chauffeur' | 'service';

/** Lifecycle: Booked → Awaiting payment → Upcoming (paid) → In progress → Completed. Cancelled / Cancelled & refunded are terminal. */
export type BookingStatus =
  | 'booked'
  | 'awaiting_payment'
  | 'upcoming'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'cancelled_refunded';

export interface BookingData {
  id: string;
  bookingRef: string;
  bookingType: BookingType;
  name: string;
  email: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  dropoffDate: string;
  dropoffTime: string;
  createdAt: string;
  status: BookingStatus;
  adminNotes: string;
  /** Customer / request notes for chauffeur & service bookings */
  additionalNotes?: string;
  lastUpdated?: string;
  carTitle?: string;
  selectedPlan?: string;
  selectedPlanPrice?: number;
  totalDays?: number;
  basePrice?: number;
  planCost?: number;
  /** Quoted total for car rental; for chauffeur/service, admin-set quote */
  totalPrice?: number;
  selectedAddons?: string;
  addonsCost?: number;
  service?: string;
}

export interface StatusConfig {
  key: BookingStatus;
  label: string;
  color: string;
  bg: string;
  dot: string;
}

export const BOOKING_STATUSES: StatusConfig[] = [
  { key: 'booked', label: 'Booked', color: 'text-slate-700', bg: 'bg-slate-100', dot: 'bg-slate-500' },
  {
    key: 'awaiting_payment',
    label: 'Awaiting payment',
    color: 'text-yellow-800',
    bg: 'bg-yellow-50',
    dot: 'bg-yellow-500',
  },
  { key: 'upcoming', label: 'Upcoming', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  {
    key: 'in_progress',
    label: 'In progress',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  { key: 'completed', label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
  {
    key: 'cancelled_refunded',
    label: 'Cancelled & refunded',
    color: 'text-rose-800',
    bg: 'bg-rose-50',
    dot: 'bg-rose-500',
  },
];

export const STATUS_MAP = Object.fromEntries(
  BOOKING_STATUSES.map((s) => [s.key, s]),
) as Record<BookingStatus, StatusConfig>;

/** Counts toward gross paid revenue (money retained from paid bookings). */
export const PAID_REVENUE_STATUSES: BookingStatus[] = ['upcoming', 'in_progress', 'completed'];

export const TYPE_LABELS: Record<BookingType, string> = {
  standard: 'Car Rental',
  chauffeur: 'Chauffeur',
  service: 'Service',
};

export const TYPE_COLOURS: Record<BookingType, string> = {
  standard: 'bg-blue-100 text-blue-800',
  chauffeur: 'bg-purple-100 text-purple-800',
  service: 'bg-amber-100 text-amber-800',
};

export const SERVICE_LABELS: Record<string, string> = {
  'chauffeur-services': 'Chauffeur',
  'event-rentals': 'Event Rental',
  'corporate-services': 'Corporate',
};
