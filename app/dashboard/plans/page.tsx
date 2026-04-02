'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DataTable from '@/components/DataTable';
import FormModal from '@/components/FormModal';
import DeleteConfirm from '@/components/DeleteConfirm';
import AdminTip from '@/components/AdminTip';

interface PlanData {
  id: string;
  name: string;
  description: string;
  price: number;
  includes: string[];
}

const emptyForm = { name: '', description: '', price: 0, includes: [] as string[] };

const columns = [
  { key: 'name', label: 'Plan Name' },
  { key: 'price', label: 'Price/Day', render: (v: unknown) => `£${v}` },
  { key: 'description', label: 'Description' },
  {
    key: 'includes',
    label: 'Includes',
    render: (v: unknown) => {
      const arr = v as string[];
      return arr?.length ? `${arr.length} items` : '—';
    },
  },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [includesText, setIncludesText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PlanData | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const snap = await getDocs(collection(db, 'plans'));
    const data = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as PlanData[];
    data.sort((a, b) => a.price - b.price);
    setPlans(data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setIncludesText(''); setModalOpen(true); };
  const openEdit = (row: Record<string, unknown>) => {
    const plan = row as unknown as PlanData;
    setEditingId(plan.id);
    setForm({ name: plan.name, description: plan.description, price: plan.price, includes: plan.includes || [] });
    setIncludesText((plan.includes || []).join('\n'));
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const includes = includesText.split('\n').map((s) => s.trim()).filter(Boolean);
    const data = { ...form, includes, price: Number(form.price) };

    if (editingId) {
      await setDoc(doc(db, 'plans', editingId), data, { merge: true });
    } else {
      await addDoc(collection(db, 'plans'), data);
    }
    setModalOpen(false);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'plans', deleteTarget.id));
    setDeleteTarget(null);
    fetchData();
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading plans...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Protection Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">{plans.length} plans available</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition">
          + Add Plan
        </button>
      </div>

      <AdminTip>
        <strong>Includes</strong> is a list of protection features (one per line). Each string must exactly match an entry in the <strong>Protection Details</strong> collection for the comparison matrix to display correctly.
        Plans are displayed sorted by price (lowest first).
      </AdminTip>

      <DataTable columns={columns} data={plans as unknown as Record<string, unknown>[]} onEdit={openEdit} onDelete={(row) => setDeleteTarget(row as unknown as PlanData)} />

      <FormModal isOpen={modalOpen} title={editingId ? 'Edit Plan' : 'Add Plan'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per Day (£)</label>
            <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Includes (one per line)</label>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows={6} placeholder={"Collision Damage Waiver\nTheft Protection\nRoadside Assistance"} value={includesText} onChange={(e) => setIncludesText(e.target.value)} />
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
