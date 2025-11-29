'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { QrCode, Loader2 } from 'lucide-react';

export function CheckInSettings() {
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
        autoCheckInEnabled: localSettings.autoCheckInEnabled,
        checkInSoundEnabled: localSettings.checkInSoundEnabled,
        showTableDirections: localSettings.showTableDirections,
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
          <QrCode className="w-5 h-5" />
          Check-in Ayarları
        </h2>
        <p className="text-slate-400 text-sm mt-1">QR kod okutma ve giriş kontrol ayarları</p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
          <div>
            <p className="font-medium">Otomatik Check-in</p>
            <p className="text-sm text-slate-400">QR okutulduğunda otomatik giriş yap</p>
          </div>
          <input
            type="checkbox"
            checked={localSettings.autoCheckInEnabled}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, autoCheckInEnabled: e.target.checked })
            }
            className="w-5 h-5 rounded bg-slate-600 border-slate-500"
          />
        </label>

        <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
          <div>
            <p className="font-medium">Ses Bildirimi</p>
            <p className="text-sm text-slate-400">Başarılı girişte ses çal</p>
          </div>
          <input
            type="checkbox"
            checked={localSettings.checkInSoundEnabled}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, checkInSoundEnabled: e.target.checked })
            }
            className="w-5 h-5 rounded bg-slate-600 border-slate-500"
          />
        </label>

        <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
          <div>
            <p className="font-medium">Masa Yol Tarifi</p>
            <p className="text-sm text-slate-400">Girişte masanın yerini göster</p>
          </div>
          <input
            type="checkbox"
            checked={localSettings.showTableDirections}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, showTableDirections: e.target.checked })
            }
            className="w-5 h-5 rounded bg-slate-600 border-slate-500"
          />
        </label>
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
