
'use client';
import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { Building, Globe, Clock, Loader2 } from 'lucide-react';

export function GeneralSettings() {
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
      await updateSettings(localSettings);
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
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Building className="w-5 h-5" />
          Genel Ayarlar
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          Firma bilgileri ve temel sistem ayarları
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Firma Adı</label>
          <input
            type="text"
            value={localSettings.companyName}
            onChange={(e) => setLocalSettings({ ...localSettings, companyName: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">
            <Globe className="w-4 h-4 inline mr-1" />
            Dil
          </label>
          <select
            value={localSettings.language}
            onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          >
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            Saat Dilimi
          </label>
          <select
            value={localSettings.timezone}
            onChange={(e) => setLocalSettings({ ...localSettings, timezone: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          >
            <option value="Europe/Istanbul">İstanbul (UTC+3)</option>
            <option value="Asia/Nicosia">KKTC (UTC+2)</option>
            <option value="Europe/London">Londra (UTC+0)</option>
            <option value="America/New_York">New York (UTC-5)</option>
          </select>
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
