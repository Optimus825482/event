"use client";

import { useState, useEffect, useRef } from "react";
import {
  User,
  Briefcase,
  Users,
  CalendarDays,
  Edit2,
  UserPlus,
  Loader2,
  Camera,
  X,
  ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { staffApi, API_BASE } from "@/lib/api";
import type { Personnel, Position, Department, WorkLocation } from "../types";

// Avatar URL helper
const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

// İsimden baş harfleri al
const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

interface PersonnelFormModalProps {
  open: boolean;
  onClose: () => void;
  personnel: Personnel | null;
  onSave: (data: Partial<Personnel>, avatarFile?: File | null) => Promise<void>;
  departments: Department[];
  locations: WorkLocation[];
  positions: Position[];
}

export function PersonnelFormModal({
  open,
  onClose,
  personnel,
  onSave,
  departments,
  locations,
  positions,
}: PersonnelFormModalProps) {
  const [activeTab, setActiveTab] = useState<
    "basic" | "work" | "personal" | "dates"
  >("basic");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Personnel>>({
    sicilNo: "",
    fullName: "",
    email: "",
    phone: "",
    position: "",
    department: "",
    workLocation: "",
    mentor: "",
    gender: undefined,
    birthDate: "",
    age: undefined,
    bloodType: "",
    shoeSize: undefined,
    sockSize: "",
    hireDate: "",
    terminationDate: "",
    terminationReason: "",
    yearsAtCompany: undefined,
    status: "active",
    avatar: "",
    color: "#3b82f6",
  });

  useEffect(() => {
    if (personnel) {
      setFormData({
        sicilNo: personnel.sicilNo || "",
        fullName: personnel.fullName || "",
        email: personnel.email || "",
        phone: personnel.phone || "",
        position: personnel.position || "",
        department: personnel.department || "",
        workLocation: personnel.workLocation || "",
        mentor: personnel.mentor || "",
        gender: personnel.gender,
        birthDate: personnel.birthDate ? personnel.birthDate.split("T")[0] : "",
        age: personnel.age,
        bloodType: personnel.bloodType || "",
        shoeSize: personnel.shoeSize,
        sockSize: personnel.sockSize || "",
        hireDate: personnel.hireDate ? personnel.hireDate.split("T")[0] : "",
        terminationDate: personnel.terminationDate
          ? personnel.terminationDate.split("T")[0]
          : "",
        terminationReason: personnel.terminationReason || "",
        yearsAtCompany: personnel.yearsAtCompany,
        status: personnel.status || "active",
        avatar: personnel.avatar || "",
        color: personnel.color || "#3b82f6",
      });
      setAvatarPreview(getAvatarUrl(personnel.avatar) || null);
    } else {
      setFormData({
        sicilNo: "",
        fullName: "",
        email: "",
        phone: "",
        position: "",
        department: "",
        workLocation: "",
        mentor: "",
        gender: undefined,
        birthDate: "",
        age: undefined,
        bloodType: "",
        shoeSize: undefined,
        sockSize: "",
        hireDate: "",
        terminationDate: "",
        terminationReason: "",
        yearsAtCompany: undefined,
        status: "active",
        avatar: "",
        color: "#3b82f6",
      });
      setAvatarPreview(null);
    }
    setAvatarFile(null);
    setActiveTab("basic");
  }, [personnel, open]);

  // Avatar dosyası seçildiğinde
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Dosya boyutu kontrolü (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Dosya boyutu 5MB'dan küçük olmalıdır");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Avatar'ı kaldır
  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setFormData((prev) => ({ ...prev, avatar: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!formData.sicilNo?.trim() || !formData.fullName?.trim()) {
      alert("Sicil No ve Ad Soyad zorunludur");
      return;
    }
    setSaving(true);
    try {
      // Avatar dosyasını da gönder
      await onSave(formData, avatarFile);
    } finally {
      setSaving(false);
    }
  };

  // Avatar yükleme (mevcut personel için)
  const handleUploadAvatar = async () => {
    if (!avatarFile || !personnel?.id) return;

    setUploadingAvatar(true);
    try {
      const response = await staffApi.uploadPersonnelAvatar(
        personnel.id,
        avatarFile
      );
      setFormData((prev) => ({ ...prev, avatar: response.data.avatar }));
      setAvatarFile(null);
      alert("Avatar başarıyla yüklendi");
    } catch (error: any) {
      alert(error.response?.data?.message || "Avatar yüklenemedi");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const tabs = [
    { key: "basic", label: "Temel Bilgiler", icon: User },
    { key: "work", label: "İş Bilgileri", icon: Briefcase },
    { key: "personal", label: "Kişisel", icon: Users },
    { key: "dates", label: "Tarihler", icon: CalendarDays },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {personnel ? (
              <Edit2 className="w-5 h-5 text-blue-400" />
            ) : (
              <UserPlus className="w-5 h-5 text-green-400" />
            )}
            {personnel ? "Personel Düzenle" : "Yeni Personel"}
          </DialogTitle>
          <p className="text-sm text-slate-400">
            Personel bilgilerini doldurun
          </p>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-purple-400 border-b-2 border-purple-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {activeTab === "basic" && (
            <div className="grid grid-cols-2 gap-4">
              {/* Avatar Upload Bölümü */}
              <div className="col-span-2 flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                <div className="relative group">
                  <Avatar
                    className="h-20 w-20 border-2 transition-all"
                    style={{ borderColor: formData.color || "#3b82f6" }}
                  >
                    <AvatarImage src={avatarPreview || undefined} />
                    <AvatarFallback className="text-lg bg-slate-600">
                      {formData.fullName ? (
                        getInitials(formData.fullName)
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-400" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  {/* Avatar varsa kaldır butonu */}
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
                      onClick={handleRemoveAvatar}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-slate-300">Profil Fotoğrafı</Label>
                  <p className="text-xs text-slate-400">
                    JPG, PNG veya WebP formatında, max 5MB
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {avatarPreview ? "Değiştir" : "Fotoğraf Seç"}
                    </Button>
                    {/* Mevcut personel için anında yükleme butonu */}
                    {personnel?.id && avatarFile && (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleUploadAvatar}
                        disabled={uploadingAvatar}
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Yükle
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                {/* Renk seçici */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Renk</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.color || "#3b82f6"}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-10 h-10 p-1 cursor-pointer bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-slate-400">Sicil No *</Label>
                <Input
                  value={formData.sicilNo}
                  onChange={(e) =>
                    setFormData({ ...formData, sicilNo: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600"
                  placeholder="Örn: 1234"
                />
              </div>
              <div>
                <Label className="text-slate-400">Ad Soyad *</Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600"
                  placeholder="Örn: Ahmet Yılmaz"
                />
              </div>
              <div>
                <Label className="text-slate-400">E-posta</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600"
                  placeholder="ornek@email.com"
                />
              </div>
              <div>
                <Label className="text-slate-400">Telefon</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600"
                  placeholder="05XX XXX XX XX"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-slate-400">Durum</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData({ ...formData, status: v as any })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Pasif</SelectItem>
                    <SelectItem value="terminated">Ayrıldı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {activeTab === "work" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400">Pozisyon (Unvan)</Label>
                <Select
                  value={formData.position || ""}
                  onValueChange={(v) =>
                    setFormData({ ...formData, position: v })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Unvan seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Bölüm</Label>
                <Select
                  value={formData.department || ""}
                  onValueChange={(v) =>
                    setFormData({ ...formData, department: v })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Bölüm seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Görev Yeri</Label>
                <Select
                  value={formData.workLocation || ""}
                  onValueChange={(v) =>
                    setFormData({ ...formData, workLocation: v })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Görev yeri seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.name}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Mentor</Label>
                <Input
                  value={formData.mentor}
                  onChange={(e) =>
                    setFormData({ ...formData, mentor: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600"
                  placeholder="Mentor adı"
                />
              </div>
            </div>
          )}

          {activeTab === "personal" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400">Cinsiyet</Label>
                <Select
                  value={formData.gender || ""}
                  onValueChange={(v) =>
                    setFormData({ ...formData, gender: v as any })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Erkek</SelectItem>
                    <SelectItem value="female">Kadın</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Doğum Tarihi</Label>
                <Input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) =>
                    setFormData({ ...formData, birthDate: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <Label className="text-slate-400">Yaş</Label>
                <Input
                  type="number"
                  value={formData.age || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      age: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <Label className="text-slate-400">Kan Grubu</Label>
                <Select
                  value={formData.bloodType || ""}
                  onValueChange={(v) =>
                    setFormData({ ...formData, bloodType: v })
                  }
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"].map(
                      (bt) => (
                        <SelectItem key={bt} value={bt}>
                          {bt}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Ayakkabı No</Label>
                <Input
                  type="number"
                  value={formData.shoeSize || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shoeSize: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className="bg-slate-700 border-slate-600"
                  placeholder="Örn: 42"
                />
              </div>
              {formData.gender === "female" && (
                <div>
                  <Label className="text-slate-400">Çorap Bedeni (Kadın)</Label>
                  <Select
                    value={formData.sockSize || ""}
                    onValueChange={(v) =>
                      setFormData({ ...formData, sockSize: v })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue placeholder="Seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {activeTab === "dates" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400">İşe Giriş Tarihi</Label>
                <Input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) =>
                    setFormData({ ...formData, hireDate: e.target.value })
                  }
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <Label className="text-slate-400">Kıdem (Yıl)</Label>
                <Input
                  type="number"
                  value={formData.yearsAtCompany || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      yearsAtCompany: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              {formData.status === "terminated" && (
                <>
                  <div>
                    <Label className="text-slate-400">Ayrılış Tarihi</Label>
                    <Input
                      type="date"
                      value={formData.terminationDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          terminationDate: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Ayrılış Nedeni</Label>
                    <Input
                      value={formData.terminationReason}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          terminationReason: e.target.value,
                        })
                      }
                      className="bg-slate-700 border-slate-600"
                      placeholder="Ayrılış nedeni"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600"
            disabled={saving}
          >
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-700"
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {personnel ? "Güncelle" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
