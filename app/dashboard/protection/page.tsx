'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AdminTip from '@/components/AdminTip';

export default function ProtectionPage() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState('');

  const fetchData = async () => {
    const snap = await getDoc(doc(db, 'protection-details', 'default'));
    if (snap.exists()) {
      setItems(snap.data().default || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await setDoc(doc(db, 'protection-details', 'default'), { default: items });
    setSaving(false);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems([...items, newItem.trim()]);
    setNewItem('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setItems(updated);
  };

  if (loading) return <div className="text-gray-400 text-sm">Loading protection details...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Protection Details</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} feature labels</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <AdminTip>
        This is a single document containing an ordered list of protection feature labels. These are the row headers in the plan comparison matrix on the website.
        Each string here must be <strong>exactly matched</strong> in a plan&apos;s &quot;includes&quot; array for a checkmark to appear.
        Order matters — items display top to bottom.
      </AdminTip>

      {/* Add new item */}
      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
          placeholder="Add new protection feature label..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
        />
        <button onClick={addItem} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition">
          Add
        </button>
      </div>

      {/* Items list */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No protection details added yet.</div>
        ) : (
          items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 group">
              <span className="text-xs text-gray-400 w-6 text-right">{i + 1}</span>
              <span className="flex-1 text-sm text-gray-700">{item}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30">
                  ↑
                </button>
                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30">
                  ↓
                </button>
                <button onClick={() => removeItem(i)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">Hover over items to see reorder/remove controls. Remember to click &quot;Save Changes&quot; after editing.</p>
      )}
    </div>
  );
}
