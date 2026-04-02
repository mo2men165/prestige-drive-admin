'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DataTable from '@/components/DataTable';
import FormModal from '@/components/FormModal';
import DeleteConfirm from '@/components/DeleteConfirm';
import AdminTip from '@/components/AdminTip';

interface OptionData {
  id: string;
  name: string;
  icon: string;
  price: number;
  type: string;
  details: string;
}

const emptyForm = { name: '', icon: '', price: 0, type: 'one-off', details: '' };

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price', render: (v: unknown, row: Record<string, unknown>) => `£${v}${row.type === 'per day' ? '/day' : ''}` },
  { key: 'type', label: 'Pricing Type' },
  { key: 'details', label: 'Details' },
];

export default function OptionsPage() {
  const [options, setOptions] = useState<OptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<OptionData | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const snap = await getDocs(collection(db, 'additionalOptions'));
    setOptions(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as OptionData[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: Record<string, unknown>) => {
    const opt = row as unknown as OptionData;
    setEditingId(opt.id);
    setForm({ name: opt.name, icon: opt.icon || '', price: opt.price, type: opt.type, details: opt.details || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, price: Number(form.price) };
    if (editingId) {
      await setDoc(doc(db, 'additionalOptions', editingId), data, { merge: true });
    } else {
      await addDoc(collection(db, 'additionalOptions'), data);
    }
    setModalOpen(false);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, 'additionalOptions', deleteTarget.id));
    setDeleteTarget(null);
    fetchData();
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading options...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Additional Options</h1>
          <p className="text-sm text-gray-500 mt-0.5">{options.length} add-on options</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition">
          + Add Option
        </button>
      </div>

      <AdminTip>
        <strong>Type</strong> must be either <code className="bg-blue-100 px-1 rounded">per day</code> (charged daily) or <code className="bg-blue-100 px-1 rounded">one-off</code> (flat fee).
        <br /><strong>Icon</strong> is raw SVG HTML code that renders as the icon on the website. You can copy SVG code from icon libraries.
      </AdminTip>

      <DataTable columns={columns} data={options as unknown as Record<string, unknown>[]} onEdit={openEdit} onDelete={(row) => setDeleteTarget(row as unknown as OptionData)} />

      <FormModal isOpen={modalOpen} title={editingId ? 'Edit Option' : 'Add Option'} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input className="w-full px-3 py-2 border rounded-lg text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (£)</label>
              <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="one-off">One-off</option>
                <option value="per day">Per Day</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon (SVG HTML)</label>
            <textarea className="w-full px-3 py-2 border rounded-lg text-sm font-mono" rows={3} placeholder='<svg xmlns="http://www.w3.org/2000/svg" ...' value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
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
