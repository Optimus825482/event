"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Check,
  Camera,
  UserPlus,
  Shield,
  Loader2,
} from "lucide-react";
import { staffApi, uploadApi, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Staff,
  StaffPosition,
  POSITION_LABELS,
  POSITION_COLORS,
  DEFAULT_COLORS,
} from "./types";

const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

interface PersonnelTabProps {
  onStaffChange?: () => void;
}

export function PersonnelTab({ onStaffChange }: PersonnelTabProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Staff | null>(null);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await staffApi.getAll();
      setStaff(response.data || []);
    } catch (error) {
      console.error("Personel listesi yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const filteredStaff = staff.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition =
      positionFilter === "all" || s.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await staffApi.delete(deleteConfirm.id);
      setStaff((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      onStaffChange?.();
    } catch (error) {
      console.error("Silme hatası:", error);
    }
  };

  const handleSaveStaff = () => {
    loadStaff();
    setShowCreateModal(false);
    setEditingStaff(null);
    onStaffChange?.();
  };

  // İstatistikler
  const stats = {
    total: staff.length,
    active: staff.filter((s) => s.isActive).length,
    byPosition: Object.entries(POSITION_LABELS).map(([key, label]) => ({
      position: key as StaffPosition,
      label,
      count: staff.filter((s) => s.position === key).length,
    })),
  };

  return (
    <div className="space-y-6">
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-400">Toplam</p>
          </CardContent>
        </Card>
        {stats.byPosition.map((item) => (
          <Card
            key={item.position}
            className="bg-slate-800/50 border-slate-700"
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-white">{item.count}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtreler ve Ekle Butonu */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Personel ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700">
              <Shield className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Görev" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Tüm Görevler</SelectItem>
              {Object.entries(POSITION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Yeni Personel
        </Button>
      </div>

      {/* Personel Listesi */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full bg-slate-700" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-2 bg-slate-700" />
                    <Skeleton className="h-3 w-16 bg-slate-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4">
            {searchQuery || positionFilter !== "all"
              ? "Arama kriterlerine uygun personel bulunamadı"
              : "Henüz personel eklenmemiş"}
          </p>
          {!searchQuery && positionFilter === "all" && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              İlk Personeli Ekle
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStaff.map((person) => (
            <Card
              key={person.id}
              className={`bg-slate-800 border-slate-700 overflow-hidden transition-all hover:border-slate-600 ${
                !person.isActive && "opacity-60"
              }`}
            >
              <div
                className="h-1"
                style={{ backgroundColor: person.color || "#3b82f6" }}
              />
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar
                    className="w-12 h-12 border-2"
                    style={{ borderColor: person.color || "#3b82f6" }}
                  >
                    <AvatarImage
                      src={getAvatarUrl(person.avatar)}
                      alt={person.fullName}
                    />
                    <AvatarFallback
                      style={{ backgroundColor: person.color || "#3b82f6" }}
                      className="text-white font-bold"
                    >
                      {person.fullName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {person.fullName}
                    </h3>
                    {person.position && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          POSITION_COLORS[person.position]
                        }`}
                      >
                        {POSITION_LABELS[person.position]}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-slate-400 mb-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate text-xs">{person.email}</span>
                  </div>
                  {person.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-xs">{person.phone}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-slate-600 bg-slate-700/50 h-8 text-xs"
                    onClick={() => setEditingStaff(person)}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Düzenle
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-red-500/30 bg-red-500/10 text-red-400 h-8 w-8"
                        onClick={() => setDeleteConfirm(person)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sil</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <StaffFormDialog
        open={showCreateModal || !!editingStaff}
        staff={editingStaff}
        onClose={() => {
          setShowCreateModal(false);
          setEditingStaff(null);
        }}
        onSave={handleSaveStaff}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Personeli Sil</DialogTitle>
            <DialogDescription className="text-slate-400">
              <strong>{deleteConfirm?.fullName}</strong> isimli personeli silmek
              istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Staff Form Dialog Component
function StaffFormDialog({
  open,
  staff,
  onClose,
  onSave,
}: {
  open: boolean;
  staff: Staff | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    color: "#3b82f6",
    position: "" as StaffPosition | "",
    avatar: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (staff) {
        setFormData({
          fullName: staff.fullName,
          email: staff.email,
          password: "",
          phone: staff.phone || "",
          color: staff.color || "#3b82f6",
          position: staff.position || "",
          avatar: staff.avatar || "",
        });
      } else {
        setFormData({
          fullName: "",
          email: "",
          password: "",
          phone: "",
          color:
            DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
          position: "",
          avatar: "",
        });
      }
      setError("");
    }
  }, [open, staff]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await uploadApi.uploadAvatar(file);
      setFormData((prev) => ({ ...prev, avatar: response.data.url }));
    } catch (err) {
      setError("Avatar yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.fullName.trim()) {
      setError("Ad soyad zorunludur");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email zorunludur");
      return;
    }
    if (!staff && !formData.password) {
      setError("Şifre zorunludur");
      return;
    }

    setSaving(true);
    try {
      if (staff) {
        await staffApi.update(staff.id, {
          fullName: formData.fullName,
          phone: formData.phone || undefined,
          color: formData.color,
          position: formData.position || undefined,
          avatar: formData.avatar || undefined,
        });
      } else {
        await staffApi.create({
          email: formData.email,
          fullName: formData.fullName,
          password: formData.password,
          phone: formData.phone || undefined,
          color: formData.color,
          position: formData.position || undefined,
          avatar: formData.avatar || undefined,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle>
            {staff ? "Personel Düzenle" : "Yeni Personel"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Personel bilgilerini girin
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar
                className="w-20 h-20 border-2"
                style={{ borderColor: formData.color }}
              >
                <AvatarImage src={getAvatarUrl(formData.avatar)} />
                <AvatarFallback
                  style={{ backgroundColor: formData.color }}
                  className="text-white text-2xl"
                >
                  {formData.fullName.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 p-1.5 bg-slate-700 rounded-full cursor-pointer hover:bg-slate-600 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Ad Soyad *</Label>
              <Input
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                placeholder="Ad Soyad"
                className="bg-slate-700 border-slate-600 h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="email@example.com"
                className="bg-slate-700 border-slate-600 h-9"
                disabled={!!staff}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefon</Label>
              <Input
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="555-0000"
                className="bg-slate-700 border-slate-600 h-9"
              />
            </div>
            {!staff && (
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Şifre *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="bg-slate-700 border-slate-600 h-9"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Görev</Label>
              <Select
                value={formData.position}
                onValueChange={(v) =>
                  setFormData({ ...formData, position: v as StaffPosition })
                }
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 h-9">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {Object.entries(POSITION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Renk</Label>
              <div className="flex gap-1 flex-wrap">
                {DEFAULT_COLORS.slice(0, 8).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      formData.color === color
                        ? "border-white scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {formData.color === color && (
                      <Check className="w-3 h-3 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
              disabled={saving}
            >
              İptal
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {staff ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
