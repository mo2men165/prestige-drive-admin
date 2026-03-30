'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DataTable from '@/components/DataTable';
import DeleteConfirm from '@/components/DeleteConfirm';

interface BookingData {
  id: string;
  bookingRef: string;
  name: string;
  email: string;
  phone: string;
  carTitle: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  dropoffDate: string;
  totalDays: number;
  totalPrice: number;
  selectedPlan: string;
  selectedAddons: string;
  createdAt: string;
}

const columns = [
  { key: 'bookingRef', label: 'Reference' },
  { key: 'name', label: 'Customer' },
  { key: 'carTitle', label: 'Vehicle' },
  { key: 'totalDays', label: 'Days' },
  { key: 'totalPrice', label: 'Total', render: (v: unknown) => `£${Number(v).toFixed(2)}` },
  { key: 'selectedPlan', label: 'Plan' },
  {
    key: 'createdAt',
    label: 'Date',
    render: (v: unknown) => {
      if (!v) return '—';
      const d = new Date(v as string);
      return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB');
    },
  },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BookingData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    const snap = await getDocs(collection(db, 'bookings'));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BookingData[];
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setBookings(data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'bookings', deleteTarget.id));
    setDeleteTarget(null);
    fetchData();
  };

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.bookingRef?.toLowerCase().includes(q) ||
      b.name?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.carTitle?.toLowerCase().includes(q)
    );
  });

  const toggleExpand = (row: Record<string, unknown>) => {
    const booking = row as unknown as BookingData;
    setExpandedId(expandedId === booking.id ? null : booking.id);
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading bookings...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">{bookings.length} total bookings</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          className="w-full max-w-sm px-3 py-2 border rounded-lg text-sm"
          placeholder="Search by ref, name, email, or vehicle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        onEdit={toggleExpand}
        onDelete={(row) => setDeleteTarget(row as unknown as BookingData)}
      />

      {/* Expanded booking details */}
      {expandedId && (() => {
        const b = bookings.find((x) => x.id === expandedId);
        if (!b) return null;
        return (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Booking Details — {b.bookingRef}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium">{b.name}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="font-medium">{b.email}</span></div>
              <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{b.phone}</span></div>
              <div><span className="text-gray-500">Vehicle:</span> <span className="font-medium">{b.carTitle}</span></div>
              <div><span className="text-gray-500">Pickup:</span> <span className="font-medium">{b.pickupLocation}</span></div>
              <div><span className="text-gray-500">Dropoff:</span> <span className="font-medium">{b.dropoffLocation}</span></div>
              <div><span className="text-gray-500">Pickup Date:</span> <span className="font-medium">{b.pickupDate}</span></div>
              <div><span className="text-gray-500">Dropoff Date:</span> <span className="font-medium">{b.dropoffDate}</span></div>
              <div><span className="text-gray-500">Days:</span> <span className="font-medium">{b.totalDays}</span></div>
              <div><span className="text-gray-500">Plan:</span> <span className="font-medium">{b.selectedPlan || 'None'}</span></div>
              <div><span className="text-gray-500">Add-ons:</span> <span className="font-medium">{b.selectedAddons || 'None'}</span></div>
              <div><span className="text-gray-500">Total:</span> <span className="font-medium">£{b.totalPrice?.toFixed(2)}</span></div>
            </div>
            <button onClick={() => setExpandedId(null)} className="mt-4 text-xs text-gray-500 hover:text-gray-700">Close details</button>
          </div>
        );
      })()}

      <DeleteConfirm isOpen={!!deleteTarget} itemName={`booking ${deleteTarget?.bookingRef || ''}`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
