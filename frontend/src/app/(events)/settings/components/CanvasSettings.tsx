"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settings-store";
import { Grid3X3, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CanvasSettings() {
  const { systemSettings, fetchSettings, updateSettings, loading } =
    useSettingsStore();
  const [localSettings, setLocalSettings] = useState(systemSettings);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
    setNotification(null);
    try {
      await updateSettings({
        defaultGridSize: localSettings.defaultGridSize,
        snapToGrid: localSettings.snapToGrid,
        showGridByDefault: localSettings.showGridByDefault,
      });
      setNotification({ type: "success", message: "Ayarlar kaydedildi" });
    } catch {
      setNotification({ type: "error", message: "Kaydetme hatası" });
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
      {notification && (
        <Alert
          variant={notification.type === "success" ? "success" : "destructive"}
          onClose={() => setNotification(null)}
        >
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Grid3X3 className="w-5 h-5" />
          Canvas Ayarları
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Yerleşim planı ve ızgara ayarları
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Izgara Boyutu (px)
          </label>
          <input
            type="number"
            value={localSettings.defaultGridSize}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                defaultGridSize: Number(e.target.value),
              })
            }
            min={10}
            max={100}
            step={5}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium">Izgaraya Yapış</p>
              <p className="text-sm text-slate-400">
                Masalar otomatik ızgaraya hizalansın
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.snapToGrid}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  snapToGrid: e.target.checked,
                })
              }
              className="w-5 h-5 rounded bg-slate-600 border-slate-500"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer">
            <div>
              <p className="font-medium">Izgarayı Varsayılan Göster</p>
              <p className="text-sm text-slate-400">
                Canvas açıldığında ızgara görünsün
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.showGridByDefault}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  showGridByDefault: e.target.checked,
                })
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
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
