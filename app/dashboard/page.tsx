'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
  BookingData,
  BookingStatus,
  BOOKING_STATUSES,
  STATUS_MAP,
  TYPE_LABELS,
  SERVICE_LABELS,
} from '@/lib/booking-types';
import { computeRevenueMetrics } from '@/lib/booking-revenue';
import { normalizeBookingDoc, syncAutoBookingStatuses } from '@/lib/booking-status';

interface CollectionStat {
  name: string;
  label: string;
  count: number;
  href: string;
}

function formatQuotedTotal(b: BookingData): string {
  if (b.totalPrice === undefined || b.totalPrice === null) return '—';
  const n = Number(b.totalPrice);
  if (!Number.isFinite(n)) return '—';
  return `£${n.toFixed(2)}`;
}

function vehicleOrService(b: BookingData): string {
  if (b.bookingType === 'standard') return b.carTitle || '—';
  return SERVICE_LABELS[b.service || ''] || b.service || '—';
}

export default function OverviewPage() {
  const [stats, setStats] = useState<CollectionStat[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const collections = [
      { name: 'cars', label: 'Cars', href: '/dashboard/cars' },
      { name: 'locations', label: 'Locations', href: '/dashboard/locations' },
      { name: 'plans', label: 'Plans', href: '/dashboard/plans' },
      { name: 'additionalOptions', label: 'Add-on Options', href: '/dashboard/options' },
      { name: 'bookings', label: 'Bookings', href: '/dashboard/bookings' },
    ];

    const results = await Promise.all(
      collections.map(async (c) => {
        const snap = await getDocs(collection(db, c.name));
        return { ...c, count: snap.size };
      }),
    );
    setStats(results);

    const bookingsSnap = await getDocs(collection(db, 'bookings'));
    const raw = bookingsSnap.docs.map((d) =>
      normalizeBookingDoc(d.id, d.data() as Record<string, unknown>),
    );
    const synced = await syncAutoBookingStatuses(db, raw);
    setBookings(synced);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const revenue = computeRevenueMetrics(bookings);
  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const statusCounts = BOOKING_STATUSES.map((s) => ({
    ...s,
    count: bookings.filter((b) => b.status === s.key).length,
  }));

  if (loading) return <div className="text-gray-400 text-sm">Loading dashboard...</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your EliteDrive4U data</p>
      </div>

      {/* Collection counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.name}
            href={s.href}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition"
          >
            <p className="text-3xl font-bold text-gray-900">{s.count}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Revenue & pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Revenue
          </h2>
          <p className="text-3xl font-bold text-gray-900">
            £
            {revenue.net.toLocaleString('en-GB', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            From bookings in upcoming, in progress, or completed
          </p>
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 space-y-1">
            {revenue.refunded > 0 && (
              <p>
                <span className="text-gray-400">Recorded in cancelled &amp; refunded</span>{' '}
                <span className="font-medium text-gray-700">
                  £
                  {revenue.refunded.toLocaleString('en-GB', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-gray-400 text-xs block mt-1">
                  Not subtracted again — those bookings are already out of the pipeline above.
                </span>
              </p>
            )}
            <p className="text-xs text-gray-400 pt-2">
              Booked and awaiting payment are excluded. Cancelling or marking refunded removes a
              booking from revenue automatically (no negative totals).
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Booking status
            </h2>
            <Link href="/dashboard/bookings" className="text-xs text-blue-600 hover:underline">
              Manage
            </Link>
          </div>
          <div className="space-y-2">
            {statusCounts.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className="text-gray-700">{s.label}</span>
                </span>
                <span className="font-semibold text-gray-900 tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent bookings</h2>
          <Link href="/dashboard/bookings" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <div className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-6 text-center">
            No bookings yet.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Ref
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Vehicle / service
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Quote
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => {
                  const st = STATUS_MAP[b.status as BookingStatus] || STATUS_MAP.booked;
                  return (
                    <tr key={b.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-mono text-xs">{b.bookingRef}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[b.bookingType]}</td>
                      <td className="px-4 py-3 text-gray-700">{b.name}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">
                        {vehicleOrService(b)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatQuotedTotal(b)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {b.createdAt
                          ? new Date(b.createdAt).toLocaleDateString('en-GB')
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
