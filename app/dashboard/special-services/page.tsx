'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AdminTip from '@/components/AdminTip';
import {
  SERVICE_PRICING_DOC_IDS,
  type ServicePricingDocId,
  SERVICE_PRICING_LABELS,
  SERVICE_PRICING_SUBTITLES,
  type ServicePricingDoc,
} from '@/lib/service-pricing';

/** Legacy single doc — migrated into `pricing/*` on first save if collection was empty */
const LEGACY_SETTINGS = doc(db, 'adminSettings', 'specialServicePricing');

type FormState = Record<ServicePricingDocId, { pricePerDay: number; notes: string }>;

const emptyForm = (): FormState => ({
  'chauffeur-services': { pricePerDay: 0, notes: '' },
  'event-rentals': { pricePerDay: 0, notes: '' },
  'corporate-services': { pricePerDay: 0, notes: '' },
});

function legacyToForm(d: Record<string, unknown>): Partial<FormState> {
  return {
    'chauffeur-services': {
      pricePerDay: Number(d.chauffeurDefaultQuote ?? d.pricePerDay) || 0,
      notes: String(d.chauffeurNotes ?? d.notes ?? ''),
    },
    'event-rentals': {
      pricePerDay: Number(d.eventRentalsDefaultQuote ?? d.pricePerDay) || 0,
      notes: String(d.eventRentalsNotes ?? d.notes ?? ''),
    },
    'corporate-services': {
      pricePerDay: Number(d.corporateDefaultQuote ?? d.pricePerDay) || 0,
      notes: String(d.corporateNotes ?? d.notes ?? ''),
    },
  };
}

export default function SpecialServicesPricingPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const snaps = await Promise.all(
        SERVICE_PRICING_DOC_IDS.map((id) => getDoc(doc(db, 'pricing', id))),
      );
      const next = emptyForm();
      let anyPricing = false;
      snaps.forEach((snap, i) => {
        const id = SERVICE_PRICING_DOC_IDS[i];
        if (snap.exists()) {
          anyPricing = true;
          const d = snap.data() as Partial<ServicePricingDoc>;
          next[id] = {
            pricePerDay: Number(d.pricePerDay) || 0,
            notes: d.notes || '',
          };
        }
      });

      if (!anyPricing) {
        const legacy = await getDoc(LEGACY_SETTINGS);
        if (legacy.exists()) {
          const merged = legacyToForm(legacy.data() as Record<string, unknown>);
          SERVICE_PRICING_DOC_IDS.forEach((id) => {
            if (merged[id]) next[id] = { ...next[id], ...merged[id] };
          });
        }
      }

      setForm(next);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const ts = new Date().toISOString();
    await Promise.all(
      SERVICE_PRICING_DOC_IDS.map((id) => {
        const row = form[id];
        const payload: ServicePricingDoc = {
          serviceKey: id,
          pricePerDay: Number(row.pricePerDay) || 0,
          notes: row.notes.trim(),
          currency: 'GBP',
          updatedAt: ts,
        };
        return setDoc(doc(db, 'pricing', id), payload, { merge: true });
      }),
    );
    setSaving(false);
  };

  const setRow = (id: ServicePricingDocId, patch: Partial<{ pricePerDay: number; notes: string }>) => {
    setForm((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Special services pricing</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Set the guide price per day for each special service. Values are stored in the{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">pricing</code> collection so the public
          site can read them with <code className="text-xs bg-gray-100 px-1 rounded">getDoc</code> or{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">getDocs</code>. Final quotes on each
          booking are still edited per booking.
        </p>
      </div>

      <AdminTip>
        Document IDs: chauffeur-services, event-rentals, corporate-services — match the{' '}
        <code className="text-xs">service</code> field on bookings.
      </AdminTip>

      <div className="space-y-8 bg-white border border-gray-200 rounded-xl p-6">
        {SERVICE_PRICING_DOC_IDS.map((id) => (
          <PricingBlock
            key={id}
            title={SERVICE_PRICING_LABELS[id]}
            subtitle={SERVICE_PRICING_SUBTITLES[id]}
            docId={id}
            pricePerDay={form[id].pricePerDay}
            notes={form[id].notes}
            onPrice={(v) => setRow(id, { pricePerDay: v })}
            onNotes={(v) => setRow(id, { notes: v })}
          />
        ))}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving…' : 'Save pricing'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PricingBlock({
  title,
  subtitle,
  docId,
  pricePerDay,
  notes,
  onPrice,
  onNotes,
}: {
  title: string;
  subtitle: string;
  docId: string;
  pricePerDay: number;
  notes: string;
  onPrice: (n: number) => void;
  onNotes: (s: string) => void;
}) {
  return (
    <div className="border-b border-gray-100 last:border-0 pb-8 last:pb-0">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500 mt-0.5 mb-1">{subtitle}</p>
      <p className="text-[11px] text-gray-400 font-mono mb-3">pricing/{docId}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Price per day (£)
          </label>
          <input
            type="number"
            step="0.01"
            min={0}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={Number.isFinite(pricePerDay) ? pricePerDay : ''}
            onChange={(e) => onPrice(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Notes (what is included, minimum hours, etc.)
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[72px] resize-y"
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Optional — can be shown on the website next to the price."
          />
        </div>
      </div>
    </div>
  );
}
