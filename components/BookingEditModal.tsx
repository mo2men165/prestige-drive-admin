'use client';

import { useState, useEffect } from 'react';
import {
  BookingData,
  BookingStatus,
  BOOKING_STATUSES,
  STATUS_MAP,
} from '@/lib/booking-types';

interface BookingEditModalProps {
  isOpen: boolean;
  booking: BookingData | null;
  locations: { id: string; name: string }[];
  onSave: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

function toISODate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const parts = dateStr.split('/');
  if (parts.length === 3 && parts[2].length === 4)
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return dateStr;
}

export default function BookingEditModal({
  isOpen,
  booking,
  locations,
  onSave,
  onClose,
}: BookingEditModalProps) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (booking) {
      setForm({
        name: booking.name ?? '',
        email: booking.email ?? '',
        phone: booking.phone ?? '',
        pickupLocation: booking.pickupLocation ?? '',
        dropoffLocation: booking.dropoffLocation ?? '',
        pickupDate: toISODate(booking.pickupDate),
        pickupTime: booking.pickupTime ?? '',
        dropoffDate: toISODate(booking.dropoffDate),
        dropoffTime: booking.dropoffTime ?? '',
        status: booking.status || 'booked',
        adminNotes: booking.adminNotes ?? '',
        additionalNotes: booking.additionalNotes ?? '',
        carTitle: booking.carTitle ?? '',
        totalDays: booking.totalDays ?? '',
        basePrice: booking.basePrice ?? '',
        selectedPlan: booking.selectedPlan ?? '',
        selectedPlanPrice: booking.selectedPlanPrice ?? '',
        planCost: booking.planCost ?? '',
        selectedAddons: booking.selectedAddons ?? '',
        addonsCost: booking.addonsCost ?? '',
        totalPrice: booking.totalPrice ?? '',
      });
    }
  }, [booking]);

  if (!isOpen || !booking) return null;

  const isStandard = booking.bookingType === 'standard';
  const isChauffeur = booking.bookingType === 'chauffeur';
  const isSpecial = !isStandard;

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        pickupLocation: form.pickupLocation,
        dropoffLocation: form.dropoffLocation,
        pickupDate: form.pickupDate,
        pickupTime: form.pickupTime,
        dropoffDate: form.dropoffDate,
        dropoffTime: form.dropoffTime,
        status: form.status,
        adminNotes: form.adminNotes || '',
        additionalNotes: (form.additionalNotes as string) || '',
        lastUpdated: new Date().toISOString(),
      };

      if (isStandard) {
        updates.carTitle = form.carTitle;
        updates.totalDays = form.totalDays !== '' ? Number(form.totalDays) : null;
        updates.basePrice = form.basePrice !== '' ? Number(form.basePrice) : null;
        updates.selectedPlan = form.selectedPlan;
        updates.selectedPlanPrice =
          form.selectedPlanPrice !== '' ? Number(form.selectedPlanPrice) : null;
        updates.planCost = form.planCost !== '' ? Number(form.planCost) : null;
        updates.selectedAddons = form.selectedAddons;
        updates.addonsCost = form.addonsCost !== '' ? Number(form.addonsCost) : null;
        updates.totalPrice = form.totalPrice !== '' ? Number(form.totalPrice) : null;
      }

      if (isSpecial) {
        updates.totalPrice = form.totalPrice !== '' ? Number(form.totalPrice) : null;
      }

      await onSave(booking.id, updates);
    } finally {
      setSaving(false);
    }
  };

  const statusInfo = STATUS_MAP[(form.status as BookingStatus) || 'booked'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-6 pb-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Booking</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{booking.bookingRef}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-10rem)] overflow-y-auto">
          {/* Status */}
          <section>
            <SectionTitle>Status</SectionTitle>
            <div className="flex items-center gap-3">
              <select
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={(form.status as string) || 'booked'}
                onChange={(e) => set('status', e.target.value)}
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color} shrink-0`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.label}
              </span>
            </div>
          </section>

          {/* Customer Information */}
          <section>
            <SectionTitle>Customer Information</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Full Name"
                value={form.name as string}
                onChange={(v) => set('name', v)}
              />
              <Field
                label="Email Address"
                value={form.email as string}
                onChange={(v) => set('email', v)}
                type="email"
              />
              <Field
                label="Phone Number"
                value={form.phone as string}
                onChange={(v) => set('phone', v)}
                type="tel"
              />
            </div>
          </section>

          {/* Trip Details */}
          <section>
            <SectionTitle>Trip Details</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isChauffeur ? (
                <>
                  <Field
                    label="Pickup Location"
                    value={form.pickupLocation as string}
                    onChange={(v) => set('pickupLocation', v)}
                  />
                  <Field
                    label="Dropoff Location"
                    value={form.dropoffLocation as string}
                    onChange={(v) => set('dropoffLocation', v)}
                  />
                </>
              ) : (
                <>
                  <SelectField
                    label="Pickup Location"
                    value={form.pickupLocation as string}
                    onChange={(v) => set('pickupLocation', v)}
                    options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  />
                  <SelectField
                    label="Dropoff Location"
                    value={form.dropoffLocation as string}
                    onChange={(v) => set('dropoffLocation', v)}
                    options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  />
                </>
              )}
              <Field
                label="Pickup Date"
                value={form.pickupDate as string}
                onChange={(v) => set('pickupDate', v)}
                type="date"
              />
              <Field
                label="Pickup Time"
                value={form.pickupTime as string}
                onChange={(v) => set('pickupTime', v)}
                type="time"
              />
              <Field
                label="Dropoff Date"
                value={form.dropoffDate as string}
                onChange={(v) => set('dropoffDate', v)}
                type="date"
              />
              <Field
                label="Dropoff Time"
                value={form.dropoffTime as string}
                onChange={(v) => set('dropoffTime', v)}
                type="time"
              />
            </div>
          </section>

          {/* Quoted total & customer notes (chauffeur / service) */}
          {isSpecial && (
            <section>
              <SectionTitle>Quote &amp; customer details</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field
                    label="Quoted total (£)"
                    value={form.totalPrice as string}
                    onChange={(v) => set('totalPrice', v)}
                    type="number"
                    step="0.01"
                    highlight
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Additional notes (from customer)
                  </label>
                  <textarea
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-y min-h-[88px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Requirements, venue, passenger count, etc."
                    value={(form.additionalNotes as string) || ''}
                    onChange={(e) => set('additionalNotes', e.target.value)}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Vehicle & Pricing (standard only) */}
          {isStandard && (
            <section>
              <SectionTitle>Vehicle &amp; Pricing</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Vehicle"
                  value={form.carTitle as string}
                  onChange={(v) => set('carTitle', v)}
                />
                <Field
                  label="Total Days"
                  value={form.totalDays as string}
                  onChange={(v) => set('totalDays', v)}
                  type="number"
                />
                <Field
                  label="Base Price (£)"
                  value={form.basePrice as string}
                  onChange={(v) => set('basePrice', v)}
                  type="number"
                  step="0.01"
                />
                <Field
                  label="Protection Plan"
                  value={form.selectedPlan as string}
                  onChange={(v) => set('selectedPlan', v)}
                />
                <Field
                  label="Plan Price / Day (£)"
                  value={form.selectedPlanPrice as string}
                  onChange={(v) => set('selectedPlanPrice', v)}
                  type="number"
                  step="0.01"
                />
                <Field
                  label="Plan Cost (£)"
                  value={form.planCost as string}
                  onChange={(v) => set('planCost', v)}
                  type="number"
                  step="0.01"
                />
                <Field
                  label="Add-ons"
                  value={form.selectedAddons as string}
                  onChange={(v) => set('selectedAddons', v)}
                  fullWidth
                />
                <Field
                  label="Add-ons Cost (£)"
                  value={form.addonsCost as string}
                  onChange={(v) => set('addonsCost', v)}
                  type="number"
                  step="0.01"
                />
                <div className="sm:col-span-2 pt-2 border-t border-gray-100">
                  <Field
                    label="Total Price (£)"
                    value={form.totalPrice as string}
                    onChange={(v) => set('totalPrice', v)}
                    type="number"
                    step="0.01"
                    highlight
                  />
                </div>
              </div>
            </section>
          )}

          {/* Admin Notes */}
          <section>
            <SectionTitle>Admin Notes</SectionTitle>
            <textarea
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-y min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Internal notes about this booking (not visible to customer)..."
              value={(form.adminNotes as string) || ''}
              onChange={(e) => set('adminNotes', e.target.value)}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
      {children}
    </h4>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  fullWidth = false,
  step,
  highlight = false,
}: {
  label: string;
  value?: string | number | null;
  onChange: (value: string) => void;
  type?: string;
  fullWidth?: boolean;
  step?: string;
  highlight?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
          highlight
            ? 'border-gray-400 font-semibold text-gray-900 bg-gray-50'
            : 'border-gray-300'
        }`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
