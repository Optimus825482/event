'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { Plus, Trash2, Palette, Loader2 } from 'lucide-react';

export function StaffColorsSettings() {
  const { staffColors, fetchStaffColors, addStaffColor, updateStaffColor, deleteStaffColor } =
    useSettingsStore();
  const [newColor, setNewColor] = useState({ name: '', color: '#3b82f6' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStaffColors();
  }, [fetchStaffColors]);

  const handleAdd = async () => {
    if (!newColor.name) return;
    setSaving(true);
    try {
      await addStaffColor(newColor);
      setNewColor({ name: '', color: '#3b82f6' });
    } catch {
      alert('Ekleme hatası');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, updates: { name?: string; color?: string }) => {
    try {
      await updateStaffColor(id, updates);
    } catch {
      alert('Güncelleme hatası');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu rengi silmek istediğinize emin misiniz?')) return;
    try {
      await deleteStaffColor(id);
    } catch {
      alert('Silme hatası');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Ekip Renkleri
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Ekip atamalarında kullanılacak renk paleti
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {staffColors.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
            <input
              type="color"
              value={item.color}
              onChange={(e) => handleUpdate(item.id, { color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer border-0"
            />
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleUpdate(item.id, { name: e.target.value })}
              className="flex-1 bg-transparent border-b border-slate-600 focus:border-blue-500 outline-none px-1 py-1"
            />
            <button onClick={() => handleDelete(item.id)} className="p-2 text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg border border-dashed border-slate-600">
        <input
          type="color"
          value={newColor.color}
          onChange={(e) => setNewColor({ ...newColor, color: e.target.value })}
          className="w-10 h-10 rounded cursor-pointer border-0"
        />
        <input
          type="text"
          value={newColor.name}
          onChange={(e) => setNewColor({ ...newColor, name: e.target.value })}
          placeholder="Renk adı..."
          className="flex-1 bg-slate-600 border border-slate-500 rounded px-3 py-2"
        />
        <button
          onClick={handleAdd}
          disabled={!newColor.name || saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Ekle
        </button>
      </div>
    </div>
  );
}
