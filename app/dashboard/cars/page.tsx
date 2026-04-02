'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DataTable from '@/components/DataTable';
import FormModal from '@/components/FormModal';
import DeleteConfirm from '@/components/DeleteConfirm';
import AdminTip from '@/components/AdminTip';

interface CarData {
  id: string;
  title: string;
  image: string;
  price: number;
  type: string;
  fuelType: string;
  transmission: string;
  description: string;
  features: string[];
}

const emptyForm: Omit<CarData, 'id'> = {
  title: '', image: '', price: 0, type: '', fuelType: '', transmission: '', description: '', features: [],
};

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'price', label: 'Price/Day', render: (v: unknown) => `£${v}` },
  { key: 'type', label: 'Type' },
  { key: 'fuelType', label: 'Fuel' },
  { key: 'transmission', label: 'Transmission' },
  {
    key: 'features',
    label: 'Features',
    render: (v: unknown) => {
      const arr = v as string[];
      return arr?.length ? `${arr.length} features` : '—';
    },
  },
];

export default function CarsPage() {
  const [cars, setCars] = useState<CarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [featuresText, setFeaturesText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CarData | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const snap = await getDocs(collection(db, 'cars'));
    const data = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as CarData[];
    setCars(data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFeaturesText('');
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    const car = row as unknown as CarData;
    setEditingId(car.id);
    setForm({ title: car.title, image: car.image, price: car.price, type: car.type, fuelType: car.fuelType, transmission: car.transmission, description: car.description, features: car.features || [] });
    setFeaturesText((car.features || []).join('\n'));
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const features = featuresText.split('\n').map((s) => s.trim()).filter(Boolean);
    const data = { ...form, features, price: Number(form.price) };

    if (editingId) {
      await setDoc(doc(db, 'cars', editingId), data, { merge: true });
    } else {
      await addDoc(collection(db, 'cars'), data);
    }

    setModalOpen(false);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'cars', deleteTarget.id));
    setDeleteTarget(null);
    fetchData();
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading cars...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cars</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cars.length} vehicles in fleet</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition">
          + Add Car
        </button>
      </div>

      <AdminTip>
        <strong>Features</strong> is a list of strings, one per line. The website matches keywords for icons: &quot;Seats&quot;, &quot;GPS&quot;, &quot;Heated&quot;, &quot;Automatic&quot;, &quot;All-Wheel Drive&quot;, &quot;Luxury&quot;, &quot;Chauffeur&quot;.
        Example: &quot;4 Seats&quot;, &quot;GPS Navigation&quot;, &quot;Heated Seats&quot;, &quot;Automatic Transmission&quot;.
        <br /><strong>Image</strong> should be a full URL to the car image.
      </AdminTip>

      <DataTable
        columns={columns}
        data={cars as unknown as Record<string, unknown>[]}
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row as unknown as CarData)}
      />

      <FormModal isOpen={modalOpen} title={editingId ? 'Edit Car' : 'Add Car'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Day (£)</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. SUV, Sedan" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Petrol, Diesel, Electric" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
              <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Automatic, Manual" value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Features (one per line)</label>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows={5} placeholder={"4 Seats\nGPS Navigation\nHeated Seats\nAutomatic Transmission"} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.title || ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
