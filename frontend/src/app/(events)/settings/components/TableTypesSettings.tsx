"use client";

import { useEffect, useState } from "react";
import { useSettingsStore, TableTypeConfig } from "@/store/settings-store";
import { Plus, Pencil, Trash2, X, Check, Loader2, Table2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Varsayılan renkler (kırmızı ve yeşil hariç)
const defaultColors = [
  "#3b82f6", // Mavi
  "#8b5cf6", // Mor
  "#f97316", // Turuncu
  "#06b6d4", // Cyan
  "#ec4899", // Pembe
  "#eab308", // Sarı
  "#6366f1", // İndigo
  "#14b8a6", // Teal
];

// Rastgele varsayılan renk seç
const getRandomDefaultColor = () => {
  return defaultColors[Math.floor(Math.random() * defaultColors.length)];
};

export function TableTypesSettings() {
  const {
    tableTypes,
    fetchTableTypes,
    addTableType,
    updateTableType,
    deleteTableType,
  } = useSettingsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    capacity: 8,
    color: getRandomDefaultColor(),
  });
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchTableTypes();
  }, [fetchTableTypes]);

  const handleAdd = async () => {
    if (!formData.name) return;
    setSaving(true);
    setNotification(null);
    try {
      await addTableType({
        name: formData.name,
        capacity: formData.capacity,
        color: formData.color,
        shape: "round",
        minSpacing: 50,
      });
      setFormData({ name: "", capacity: 8, color: getRandomDefaultColor() });
      setShowAddForm(false);
      setNotification({ type: "success", message: "Masa türü eklendi" });
    } catch {
      setNotification({ type: "error", message: "Ekleme hatası" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    setNotification(null);
    try {
      await updateTableType(id, {
        name: formData.name,
        capacity: formData.capacity,
        color: formData.color,
      });
      setEditingId(null);
      setNotification({ type: "success", message: "Masa türü güncellendi" });
    } catch {
      setNotification({ type: "error", message: "Güncelleme hatası" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTableType(id);
      setNotification({ type: "success", message: "Masa türü silindi" });
    } catch {
      setNotification({ type: "error", message: "Silme hatası" });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const startEdit = (type: TableTypeConfig) => {
    setEditingId(type.id);
    setFormData({
      name: type.name,
      capacity: type.capacity,
      color: type.color,
    });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Table2 className="w-5 h-5" />
            Masa Türleri
          </h2>
          <p className="text-slate-400 text-sm">
            Masa kategorileri ve kapasiteleri
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({
              name: "",
              capacity: 8,
              color: getRandomDefaultColor(),
            });
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Yeni Tür
        </button>
      </div>

      {/* Yeni Ekleme Formu */}
      {showAddForm && (
        <div className="p-4 bg-slate-700 rounded-lg border border-blue-500">
          <h3 className="font-medium mb-4">Yeni Masa Türü</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm text-slate-400 mb-1">
                Masa Tipi Adı
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Örn: VIP, Standart, Loca"
                className="w-full bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-sm text-slate-400 mb-1">
                Kişi Sayısı
              </label>
              <input
                type="number"
                min={1}
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: Number(e.target.value) })
                }
                className="w-full bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="w-20">
              <label className="block text-sm text-slate-400 mb-1">Renk</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="w-full h-10 bg-slate-600 border border-slate-500 rounded-lg cursor-pointer"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !formData.name}
              className="px-4 py-2 bg-blue-600 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Ekle
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-600 rounded-lg"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Masa Türleri Listesi - Alfabetik Sıralı */}
      <div className="space-y-2">
        {[...tableTypes]
          .sort((a, b) => a.name.localeCompare(b.name, "tr"))
          .map((type) => {
            const isLoca = type.name.toLowerCase() === "loca";

            return (
              <div
                key={type.id}
                className={`flex items-center gap-4 p-4 bg-slate-700 rounded-lg ${
                  isLoca ? "opacity-60" : ""
                }`}
              >
                {editingId === type.id && !isLoca ? (
                  // Düzenleme Modu
                  <>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-10 h-10 rounded-lg cursor-pointer border-0"
                    />
                    <div className="flex-1">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        min={1}
                        value={formData.capacity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            capacity: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-600 border border-slate-500 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(type.id)}
                        disabled={saving}
                        className="p-2 bg-green-600 rounded-lg"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 bg-slate-600 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  // Görüntüleme Modu
                  <>
                    <div
                      className="w-10 h-10 rounded-lg"
                      style={{ backgroundColor: type.color }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {type.name}
                        {isLoca && (
                          <span className="ml-2 text-xs text-slate-400">
                            (Sabit)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="w-28 text-slate-400">
                      {type.capacity} kişilik
                    </div>
                    {!isLoca && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(type)}
                          className="p-2 bg-slate-600 rounded-lg"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(type.id)}
                          className="p-2 bg-red-600/20 text-red-400 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

        {tableTypes.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            Henüz masa türü tanımlanmamış
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title="Masa Türünü Sil"
        description="Bu masa türünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Sil"
        cancelText="İptal"
        variant="destructive"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}
