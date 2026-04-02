/** Document IDs in the `pricing` collection — match `service` / booking keys on the public site. */
export const SERVICE_PRICING_DOC_IDS = [
  'chauffeur-services',
  'event-rentals',
  'corporate-services',
] as const;

export type ServicePricingDocId = (typeof SERVICE_PRICING_DOC_IDS)[number];

export interface ServicePricingDoc {
  serviceKey: string;
  /** Guide price per day (£) — shown on the website and in admin */
  pricePerDay: number;
  notes: string;
  currency: 'GBP';
  updatedAt: string;
}

export const SERVICE_PRICING_LABELS: Record<ServicePricingDocId, string> = {
  'chauffeur-services': 'Chauffeur',
  'event-rentals': 'Event rentals',
  'corporate-services': 'Corporate services',
};

export const SERVICE_PRICING_SUBTITLES: Record<ServicePricingDocId, string> = {
  'chauffeur-services': 'Chauffeur service bookings',
  'event-rentals': 'Service type: event rentals',
  'corporate-services': 'Service type: corporate',
};
