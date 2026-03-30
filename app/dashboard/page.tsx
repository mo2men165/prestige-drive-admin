'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface CollectionStat {
  name: string;
  label: string;
  count: number;
  href: string;
}

interface RecentBooking {
  bookingRef: string;
  name: string;
  carTitle: string;
  totalPrice: number;
  createdAt: string;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<CollectionStat[]>([]);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
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
        })
      );

      setStats(results);

      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      const bookings = bookingsSnap.docs
        .map((d) => d.data() as RecentBooking)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      setRecentBookings(bookings);
      setLoading(false);
    };

    fetchAll();
  }, []);

  if (loading) return <div className="text-gray-400 text-sm">Loading dashboard...</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your EliteDrive4U data</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
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

      {/* Recent Bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
          <Link href="/dashboard/bookings" className="text-sm text-blue-600 hover:underline">View all</Link>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ref</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.bookingRef} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono text-xs">{b.bookingRef}</td>
                    <td className="px-4 py-3 text-gray-700">{b.name}</td>
                    <td className="px-4 py-3 text-gray-700">{b.carTitle}</td>
                    <td className="px-4 py-3 text-gray-700">£{b.totalPrice?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
