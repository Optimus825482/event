'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { Ticket, Loader2 } from 'lucide-react';

export function ReservationSettings() {
  const { systemSettings, fetchSettings, updateSettings, loading } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(systemSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (systemSettings) {
      setLocalSettings(systemSettings);
    }
  }, [systemSettings]);

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      await updateSettings({
        defaultGuestCount: localSettings.defaultGuestCount,
        allowOverbooking: localSettings.allowOverbooking,
        requirePhoneNumber: localSettings.requirePhoneNumber,
        requireEmail: localSettings.requireEmail,
      });
      alert('Ayarlar kaydedildi');
    } catch {
      alert('Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !localSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Ticket className="w-5 h-5" />
          Rezervasyon Ayarları
        </h2>
        <p className="text-slate-400 text-sm mt-1">Rezervasyon kuralları ve zorunlu alanlar</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Varsayılan Kişi Sayısı</label>
          <input
            type="number"
            value={localSettings.defaultGuestCount}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, defaultGuestCount: Number(e.target.value) })
            }
            min={1}
            max={20}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium">Overbooking İzni</p>
              <p className="text-sm text-slate-400">Masa kapasitesinin üzerinde rezervasyon</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.allowOverbooking}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, allowOverbooking: e.target.checked })
              }
              className="w-5 h-5 rounded bg-slate-600 border-slate-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium">Telefon Zorunlu</p>
              <p className="text-sm text-slate-400">Rezervasyonda telefon numarası şart</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.requirePhoneNumber}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, requirePhoneNumber: e.target.checked })
              }
              className="w-5 h-5 rounded bg-slate-600 border-slate-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium">E-posta Zorunlu</p>
              <p className="text-sm text-slate-400">Rezervasyonda e-posta adresi şart</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.requireEmail}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, requireEmail: e.target.checked })
              }
              className="w-5 h-5 rounded bg-slate-600 border-slate-500"
            />
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
