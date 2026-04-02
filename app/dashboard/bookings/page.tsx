'use client';

import { useEffect, useState, useMemo, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  BookingData,
  BookingType,
  BookingStatus,
  BOOKING_STATUSES,
  STATUS_MAP,
  TYPE_LABELS,
  TYPE_COLOURS,
  SERVICE_LABELS,
} from '@/lib/booking-types';
import { computeRevenueMetrics, bookingMonetaryTotal } from '@/lib/booking-revenue';
import { normalizeBookingDoc, syncAutoBookingStatuses } from '@/lib/booking-status';
import BookingEditModal from '@/components/BookingEditModal';
import DeleteConfirm from '@/components/DeleteConfirm';

const ITEMS_PER_PAGE = 15;

type SortField = 'createdAt' | 'pickupDate' | 'name' | 'totalPrice' | 'bookingRef';
type SortDir = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function resolveLocation(
  value: string,
  locationMap: Map<string, string>,
  bookingType: BookingType,
): string {
  if (bookingType === 'chauffeur') return value || '—';
  return locationMap.get(value) || value || '—';
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function csvEscape(val: string | number | undefined | null): string {
  if (val == null) return '';
  const s = String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [locationMap, setLocationMap] = useState<Map<string, string>>(new Map());
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<BookingType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editTarget, setEditTarget] = useState<BookingData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusMenu, setStatusMenu] = useState<{
    bookingId: string;
    top: number;
    left: number;
  } | null>(null);

  /* ---- Data fetching ---- */

  const fetchData = useCallback(async () => {
    const [bookingSnap, locationSnap] = await Promise.all([
      getDocs(collection(db, 'bookings')),
      getDocs(collection(db, 'locations')),
    ]);

    const locMap = new Map<string, string>();
    const locs: { id: string; name: string }[] = [];
    locationSnap.docs.forEach((d) => {
      const data = d.data();
      locMap.set(d.id, data.name as string);
      locs.push({ id: d.id, name: data.name as string });
    });
    setLocationMap(locMap);
    setLocations(locs);

    const data = bookingSnap.docs.map((d) =>
      normalizeBookingDoc(d.id, d.data() as Record<string, unknown>),
    );
    const synced = await syncAutoBookingStatuses(db, data);
    setBookings(synced);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (
      statusMenu &&
      !bookings.some((b) => b.id === statusMenu.bookingId)
    ) {
      setStatusMenu(null);
    }
  }, [statusMenu, bookings]);

  /* ---- Filtering, sorting, pagination ---- */

  const filtered = useMemo(() => {
    const result = bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (typeFilter !== 'all' && b.bookingType !== typeFilter) return false;
      if (dateFrom) {
        const pickup = parseDate(b.pickupDate);
        const from = parseDate(dateFrom);
        if (pickup && from && pickup < from) return false;
      }
      if (dateTo) {
        const pickup = parseDate(b.pickupDate);
        const to = parseDate(dateTo);
        if (pickup && to && pickup > to) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          b.bookingRef?.toLowerCase().includes(q) ||
          b.name?.toLowerCase().includes(q) ||
          b.email?.toLowerCase().includes(q) ||
          b.phone?.toLowerCase().includes(q) ||
          b.carTitle?.toLowerCase().includes(q) ||
          b.service?.toLowerCase().includes(q) ||
          b.adminNotes?.toLowerCase().includes(q) ||
          b.additionalNotes?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'pickupDate':
          cmp = new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime();
          break;
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '');
          break;
        case 'totalPrice':
          cmp = bookingMonetaryTotal(a) - bookingMonetaryTotal(b);
          break;
        case 'bookingRef':
          cmp = (a.bookingRef || '').localeCompare(b.bookingRef || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [bookings, statusFilter, typeFilter, dateFrom, dateTo, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, search, dateFrom, dateTo]);

  /* ---- Stats ---- */

  const stats = useMemo(() => {
    const rev = computeRevenueMetrics(bookings);
    return {
      total: bookings.length,
      booked: bookings.filter((b) => b.status === 'booked').length,
      awaitingPayment: bookings.filter((b) => b.status === 'awaiting_payment').length,
      upcoming: bookings.filter((b) => b.status === 'upcoming').length,
      inProgress: bookings.filter((b) => b.status === 'in_progress').length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      refunded: bookings.filter((b) => b.status === 'cancelled_refunded').length,
      revenueNet: rev.net,
      revenueRefunds: rev.refunded,
    };
  }, [bookings]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: bookings.length };
    BOOKING_STATUSES.forEach((s) => {
      counts[s.key] = bookings.filter((b) => b.status === s.key).length;
    });
    return counts;
  }, [bookings]);

  /* ---- Handlers ---- */

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'bookings', deleteTarget.id));
    setDeleteTarget(null);
    setExpandedId(null);
    fetchData();
  };

  const handleSave = async (id: string, updates: Record<string, unknown>) => {
    await updateDoc(doc(db, 'bookings', id), updates);
    setEditTarget(null);
    fetchData();
  };

  const handleQuickStatus = async (bookingId: string, newStatus: BookingStatus) => {
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: newStatus,
      lastUpdated: new Date().toISOString(),
    });
    setStatusMenu(null);
    fetchData();
  };

  const handleBulkStatus = async (newStatus: BookingStatus) => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        updateDoc(doc(db, 'bookings', id), {
          status: newStatus,
          lastUpdated: new Date().toISOString(),
        }),
      ),
    );
    setSelectedIds(new Set());
    fetchData();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} booking(s)? This cannot be undone.`)) return;
    await Promise.all(Array.from(selectedIds).map((id) => deleteDoc(doc(db, 'bookings', id))));
    setSelectedIds(new Set());
    setExpandedId(null);
    fetchData();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((b) => b.id)));
    }
  };

  const exportCSV = () => {
    const headers = [
      'Reference',
      'Status',
      'Type',
      'Customer',
      'Email',
      'Phone',
      'Vehicle/Service',
      'Pickup Location',
      'Pickup Date',
      'Pickup Time',
      'Dropoff Location',
      'Dropoff Date',
      'Dropoff Time',
      'Total Price',
      'Created',
      'Admin Notes',
      'Additional Notes',
    ];
    const rows = filtered.map((b) =>
      [
        b.bookingRef,
        STATUS_MAP[b.status]?.label || b.status,
        TYPE_LABELS[b.bookingType],
        b.name,
        b.email,
        b.phone,
        b.bookingType === 'standard'
          ? b.carTitle
          : SERVICE_LABELS[b.service || ''] || b.service,
        resolveLocation(b.pickupLocation, locationMap, b.bookingType),
        b.pickupDate,
        b.pickupTime,
        resolveLocation(b.dropoffLocation, locationMap, b.bookingType),
        b.dropoffDate,
        b.dropoffTime,
        bookingMonetaryTotal(b) || '',
        b.createdAt,
        b.adminNotes,
        b.additionalNotes,
      ]
        .map(csvEscape)
        .join(','),
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    search || statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo;

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          Loading bookings...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage and track all customer bookings
          </p>
          <p className="text-xs text-gray-400 mt-2 max-w-3xl leading-relaxed">
            Lifecycle: Booked → Awaiting payment (after invoice) → Upcoming when paid. Upcoming
            advances to In progress at pickup and Completed at dropoff automatically. Cancelled and
            Cancelled &amp; refunded remove the booking from recognized revenue (no double-counting).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
            title="Refresh"
          >
            ↻
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Booked" value={stats.booked} accent="slate" />
        <StatCard label="Awaiting payment" value={stats.awaitingPayment} accent="yellow" />
        <StatCard label="Upcoming" value={stats.upcoming} accent="blue" />
        <StatCard label="In progress" value={stats.inProgress} accent="amber" />
        <StatCard label="Completed" value={stats.completed} accent="emerald" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 border-l-4 border-l-gray-900">
          <p className="text-2xl font-bold text-gray-900">
            £
            {stats.revenueNet.toLocaleString('en-GB', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Recognized revenue (upcoming + in progress + completed)
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {stats.revenueRefunds > 0 ? (
              <>
                Cancelled &amp; refunded bookings total £
                {stats.revenueRefunds.toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                (reference only — not deducted from the figure above).
              </>
            ) : (
              <>Cancelling a paid booking removes it from this total; revenue cannot go negative.</>
            )}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 border-l-4 border-l-red-300 flex items-center gap-6">
          <div>
            <p className="text-xl font-bold text-gray-900">{stats.cancelled}</p>
            <p className="text-xs text-gray-500 mt-0.5">Cancelled</p>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <p className="text-xl font-bold text-gray-900">{stats.refunded}</p>
            <p className="text-xs text-gray-500 mt-0.5">Cancelled &amp; refunded</p>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <FilterTab
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          label="All"
          count={statusCounts.all}
        />
        {BOOKING_STATUSES.map((s) => (
          <FilterTab
            key={s.key}
            active={statusFilter === s.key}
            onClick={() => setStatusFilter(s.key)}
            label={s.label}
            count={statusCounts[s.key] ?? 0}
          />
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as BookingType | 'all')}
          >
            <option value="all">All Types</option>
            <option value="standard">Car Rental</option>
            <option value="chauffeur">Chauffeur</option>
            <option value="service">Service</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px] max-w-sm">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            placeholder="Reference, name, email, vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Pickup from
          </label>
          <input
            type="date"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Pickup to
          </label>
          <input
            type="date"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-5 bg-blue-200" />
          <select
            className="px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg bg-white text-blue-800 font-medium"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) handleBulkStatus(e.target.value as BookingStatus);
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              Change status to...
            </option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleBulkDelete}
            className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg font-medium transition"
          >
            Delete selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && (
        <p className="text-xs text-gray-500 mb-2">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
          <p className="text-lg mb-1">
            {hasActiveFilters ? 'No bookings match your filters' : 'No bookings yet'}
          </p>
          <p className="text-xs">
            {hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Bookings from your website will appear here.'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl bg-white min-w-0">
          <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === paginated.length && paginated.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <SortableHeader
                    field="bookingRef"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  >
                    Ref
                  </SortableHeader>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <SortableHeader
                    field="name"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  >
                    Customer
                  </SortableHeader>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Vehicle / Service
                  </th>
                  <SortableHeader
                    field="pickupDate"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  >
                    Pickup
                  </SortableHeader>
                  <SortableHeader
                    field="totalPrice"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  >
                    Total
                  </SortableHeader>
                  <SortableHeader
                    field="createdAt"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  >
                    Booked
                  </SortableHeader>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((b) => {
                  const isExpanded = expandedId === b.id;

                  return (
                    <Fragment key={b.id}>
                      <tr
                        className={`border-b border-gray-100 hover:bg-gray-50/50 transition cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : b.id)}
                      >
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(b.id)}
                            onChange={() => toggleSelect(b.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-900 font-medium whitespace-nowrap">
                          {b.bookingRef}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOURS[b.bookingType]}`}
                          >
                            {TYPE_LABELS[b.bookingType]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-[140px]">
                            {b.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[140px]">
                            {b.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 truncate max-w-[140px]">
                          {b.bookingType === 'standard'
                            ? b.carTitle || '—'
                            : SERVICE_LABELS[b.service || ''] || b.service || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatDate(b.pickupDate)}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">
                          {formatQuotedTotal(b)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {formatDate(b.createdAt)}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => setEditTarget(b)}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded font-medium transition"
                            >
                              Edit
                            </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const btn = e.currentTarget;
                                  const r = btn.getBoundingClientRect();
                                  const menuWidth = 220;
                                  const left = Math.min(
                                    Math.max(8, r.right - menuWidth),
                                    window.innerWidth - menuWidth - 8,
                                  );
                                  setStatusMenu((prev) =>
                                    prev?.bookingId === b.id
                                      ? null
                                      : {
                                          bookingId: b.id,
                                          top: r.bottom + 6,
                                          left,
                                        },
                                  );
                                }}
                                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded font-medium transition"
                              >
                                Status ▾
                              </button>
                            </div>
                            <button
                              onClick={() => setDeleteTarget(b)}
                              className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded font-medium transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <BookingDetailPanel
                              booking={b}
                              locationMap={locationMap}
                              onEdit={() => setEditTarget(b)}
                              onClose={() => setExpandedId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            {generatePageNumbers(safePage, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="px-2 text-gray-400 text-xs">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition ${
                    safePage === p
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <BookingEditModal
        isOpen={!!editTarget}
        booking={editTarget}
        locations={locations}
        onSave={handleSave}
        onClose={() => setEditTarget(null)}
      />

      {typeof document !== 'undefined' &&
        statusMenu &&
        (() => {
          const row = bookings.find((x) => x.id === statusMenu.bookingId);
          if (!row) return null;
          return createPortal(
            <>
              <div
                className="fixed inset-0 z-[200]"
                aria-hidden
                onClick={() => setStatusMenu(null)}
              />
              <div
                role="menu"
                className="fixed z-[201] bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[220px] max-h-[min(70vh,420px)] overflow-y-auto"
                style={{ top: statusMenu.top, left: statusMenu.left }}
              >
                {BOOKING_STATUSES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    role="menuitem"
                    onClick={() => handleQuickStatus(row.id, s.key)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 transition ${
                      row.status === s.key ? 'font-semibold bg-gray-50' : ''
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                    {s.label}
                    {row.status === s.key && (
                      <span className="text-gray-400 ml-auto">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          );
        })()}

      {/* Delete Confirm */}
      <DeleteConfirm
        isOpen={!!deleteTarget}
        itemName={`booking ${deleteTarget?.bookingRef || ''}`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function formatQuotedTotal(b: BookingData): string {
  if (b.totalPrice === undefined || b.totalPrice === null) return '—';
  const n = Number(b.totalPrice);
  if (!Number.isFinite(n)) return '—';
  return `£${n.toFixed(2)}`;
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const info = STATUS_MAP[status] || STATUS_MAP.booked;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${info.bg} ${info.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'emerald' | 'blue' | 'amber' | 'slate' | 'yellow';
}) {
  const accentMap: Record<string, string> = {
    emerald: 'border-l-emerald-400',
    blue: 'border-l-blue-400',
    amber: 'border-l-amber-400',
    slate: 'border-l-slate-400',
    yellow: 'border-l-yellow-400',
  };
  const borderClass = accent ? accentMap[accent] : 'border-l-gray-300';

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-4 border-l-4 ${borderClass}`}
    >
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md transition font-medium ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      <span className="ml-1.5 text-xs text-gray-400">{count}</span>
    </button>
  );
}

function SortableHeader({
  field,
  current,
  dir,
  onSort,
  children,
}: {
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  return (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 transition"
      onClick={(e) => {
        e.stopPropagation();
        onSort(field);
      }}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          <span className="text-gray-900">{dir === 'asc' ? '↑' : '↓'}</span>
        ) : (
          <span className="text-gray-300">↕</span>
        )}
      </span>
    </th>
  );
}

function BookingDetailPanel({
  booking: b,
  locationMap,
  onEdit,
  onClose,
}: {
  booking: BookingData;
  locationMap: Map<string, string>;
  onEdit: () => void;
  onClose: () => void;
}) {
  const type = b.bookingType || 'standard';
  const pickup = resolveLocation(b.pickupLocation, locationMap, type);
  const dropoff = resolveLocation(b.dropoffLocation, locationMap, type);

  return (
    <div className="bg-gray-50/80 border-t border-gray-100 px-6 py-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h3 className="font-semibold text-gray-900">{b.bookingRef}</h3>
          <StatusBadge status={b.status} />
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOURS[type]}`}
          >
            {TYPE_LABELS[type]}
          </span>
          {b.adminNotes && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
              Admin notes
            </span>
          )}
          {type !== 'standard' && b.additionalNotes?.trim() && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
              Customer notes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
          >
            Edit Booking
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
        <Detail label="Customer" value={b.name} />
        <Detail label="Email" value={b.email} />
        <Detail label="Phone" value={b.phone} />
        <Detail label="Created" value={formatDate(b.createdAt)} />

        {type === 'standard' && <Detail label="Vehicle" value={b.carTitle} />}
        {type !== 'standard' && (
          <Detail
            label="Service"
            value={SERVICE_LABELS[b.service || ''] || b.service}
          />
        )}

        <Detail
          label="Pickup"
          value={`${pickup} — ${formatDate(b.pickupDate)}${b.pickupTime ? ` at ${b.pickupTime}` : ''}`}
        />
        <Detail
          label="Dropoff"
          value={`${dropoff} — ${formatDate(b.dropoffDate)}${b.dropoffTime ? ` at ${b.dropoffTime}` : ''}`}
        />

        {type !== 'standard' && (
          <Detail
            label="Quoted total"
            value={formatQuotedTotal(b)}
            highlight={formatQuotedTotal(b) !== '—'}
          />
        )}

        {type !== 'standard' && b.additionalNotes?.trim() && (
          <div className="col-span-2 md:col-span-4 mt-1">
            <p className="text-xs font-medium text-gray-500 mb-1">Additional notes (customer)</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded-lg border border-violet-100 px-3 py-2">
              {b.additionalNotes}
            </p>
          </div>
        )}

        {type === 'standard' && (
          <>
            <Detail label="Duration" value={b.totalDays ? `${b.totalDays} day(s)` : undefined} />
            <Detail label="Protection Plan" value={b.selectedPlan} />
            {b.selectedPlanPrice != null && (
              <Detail label="Plan Price" value={`£${b.selectedPlanPrice.toFixed(2)}/day`} />
            )}
            {b.selectedAddons && <Detail label="Add-ons" value={b.selectedAddons} />}
            {b.addonsCost != null && (
              <Detail label="Add-ons Cost" value={`£${b.addonsCost.toFixed(2)}`} />
            )}
            {b.basePrice != null && (
              <Detail label="Base Price" value={`£${b.basePrice.toFixed(2)}`} />
            )}
            {b.planCost != null && (
              <Detail label="Plan Cost" value={`£${b.planCost.toFixed(2)}`} />
            )}
            {b.totalPrice != null && (
              <Detail label="Total Price" value={`£${b.totalPrice.toFixed(2)}`} highlight />
            )}
          </>
        )}
      </div>

      {b.adminNotes && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-1">Admin Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg border border-gray-200 px-3 py-2">
            {b.adminNotes}
          </p>
        </div>
      )}

      {b.lastUpdated && (
        <p className="text-xs text-gray-400 mt-3">Last updated: {formatDate(b.lastUpdated)}</p>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value?: string | number | null;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p
        className={`${highlight ? 'font-bold text-gray-900 text-base' : 'font-medium text-gray-700'}`}
      >
        {value ?? '—'}
      </p>
    </div>
  );
}
