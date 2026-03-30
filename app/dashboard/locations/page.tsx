'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DataTable from '@/components/DataTable';
import FormModal from '@/components/FormModal';
import DeleteConfirm from '@/components/DeleteConfirm';
import AdminTip from '@/components/AdminTip';

interface LocationData {
  id: string;
  name: string;
  address: string;
  googleMapsLink: string;
}

const emptyForm = { name: '', address: '', googleMapsLink: '' };

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'address', label: 'Address' },
  {
    key: 'googleMapsLink',
    label: 'Maps Link',
    render: (v: unknown) => v ? (
      <a href={v as string} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Map</a>
    ) : '—',
  },
];

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<LocationData | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const snap = await getDocs(collection(db, 'locations'));
    setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as LocationData[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: Record<string, unknown>) => {
    const loc = row as unknown as LocationData;
    setEditingId(loc.id);
    setForm({ name: loc.name, address: loc.address, googleMapsLink: loc.googleMapsLink || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingId) {
      await setDoc(doc(db, 'locations', editingId), form, { merge: true });
    } else {
      await addDoc(collection(db, 'locations'), form);
    }
    setModalOpen(false);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'locations', deleteTarget.id));
    setDeleteTarget(null);
    fetchData();
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading locations...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{locations.length} pickup/dropoff locations</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition">
          + Add Location
        </button>
      </div>

      <AdminTip>
        Each location needs a <strong>name</strong> (short label), <strong>address</strong> (full street address), and a <strong>Google Maps link</strong> (full URL from Google Maps sharing).
        These appear in the pickup/dropoff dropdowns on the website.
      </AdminTip>

      <DataTable columns={columns} data={locations as unknown as Record<string, unknown>[]} onEdit={openEdit} onDelete={(row) => setDeleteTarget(row as unknown as LocationData)} />

      <FormModal isOpen={modalOpen} title={editingId ? 'Edit Location' : 'Add Location'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Brighton City Centre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. 95 Ditchling Rd, Brighton BN1 4ST" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link</label>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://maps.google.com/..." value={form.googleMapsLink} onChange={(e) => setForm({ ...form, googleMapsLink: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm isOpen={!!deleteTarget} itemName={deleteTarget?.name || ''} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
