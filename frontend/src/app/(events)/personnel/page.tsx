"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Search,
  Filter,
  Upload,
  Download,
  Eye,
  X,
  Building2,
  MapPin,
  Briefcase,
  Calendar,
  Droplet,
  Footprints,
  UserCircle,
  ChevronDown,
  MoreHorizontal,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Camera,
  User,
  Hash,
  Heart,
  Shirt,
  CalendarDays,
  Award,
  AlertCircle,
} from "lucide-react";
import { staffApi, uploadApi, API_BASE } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Personnel, PersonnelStats, PersonnelFilters } from "@/types";
import { useToast } from "@/components/ui/toast-notification";

// ==================== CONSTANTS ====================

const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: "Aktif",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  inactive: {
    label: "Pasif",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    icon: <Clock className="w-3 h-3" />,
  },
  terminated: {
    label: "Ayrıldı",
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const GENDER_LABELS: Record<string, string> = {
  male: "Erkek",
  female: "Kadın",
};

const BLOOD_TYPES = [
  "A RH +",
  "A RH -",
  "B RH +",
  "B RH -",
  "AB RH +",
  "AB RH -",
  "0 RH +",
  "0 RH -",
];
const SOCK_SIZES = ["S", "M", "L", "XL", "XXL"];

// ==================== HELPER FUNCTIONS ====================

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR");
  } catch {
    return dateStr;
  }
};

// ==================== STAT CARD COMPONENT ====================

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard = ({ title, value, icon, color, subtitle }: StatCardProps) => (
  <Card className="relative overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      </div>
    </CardContent>
  </Card>
);

// ==================== PERSONNEL ROW COMPONENT ====================

interface PersonnelRowProps {
  person: Personnel;
  onView: (p: Personnel) => void;
  onEdit: (p: Personnel) => void;
  onDelete: (p: Personnel) => void;
}

const PersonnelRow = ({
  person,
  onView,
  onEdit,
  onDelete,
}: PersonnelRowProps) => {
  const status = STATUS_CONFIG[person.status] || STATUS_CONFIG.active;

  return (
    <TableRow className="group hover:bg-muted/50 transition-colors">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar
            className="h-10 w-10 border-2"
            style={{ borderColor: person.color || "#3b82f6" }}
          >
            <AvatarImage
              src={getAvatarUrl(person.avatar)}
              alt={person.fullName}
            />
            <AvatarFallback className="text-xs font-medium bg-muted">
              {getInitials(person.fullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{person.fullName}</p>
            <p className="text-xs text-muted-foreground">{person.sicilNo}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-normal">
          {person.position}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Building2 className="w-3.5 h-3.5" />
          {person.department || "-"}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          {person.workLocation || "-"}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`${status.color} gap-1`}>
          {status.icon}
          {status.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onView(person)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(person)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(person)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

// ==================== PERSONNEL DETAIL MODAL ====================

interface PersonnelDetailModalProps {
  person: Personnel | null;
  open: boolean;
  onClose: () => void;
}

const PersonnelDetailModal = ({
  person,
  open,
  onClose,
}: PersonnelDetailModalProps) => {
  if (!person) return null;
  const status = STATUS_CONFIG[person.status] || STATUS_CONFIG.active;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar
              className="h-12 w-12 border-2"
              style={{ borderColor: person.color || "#3b82f6" }}
            >
              <AvatarImage src={getAvatarUrl(person.avatar)} />
              <AvatarFallback>{getInitials(person.fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <span>{person.fullName}</span>
              <p className="text-sm font-normal text-muted-foreground">
                {person.sicilNo}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Durum ve Pozisyon */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${status.color} gap-1`}>
              {status.icon}
              {status.label}
            </Badge>
            <Badge variant="secondary">{person.position}</Badge>
            {person.gender && (
              <Badge variant="outline">{GENDER_LABELS[person.gender]}</Badge>
            )}
          </div>

          {/* İş Bilgileri */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Bölüm
              </Label>
              <p className="font-medium">{person.department || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Görev Yeri
              </Label>
              <p className="font-medium">{person.workLocation || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" /> Miço
              </Label>
              <p className="font-medium">{person.mentor || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Award className="w-3 h-3" /> Kıdem
              </Label>
              <p className="font-medium">
                {person.yearsAtCompany ? `${person.yearsAtCompany} yıl` : "-"}
              </p>
            </div>
          </div>

          {/* İletişim */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" /> Telefon
              </Label>
              <p className="font-medium">{person.phone || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-posta
              </Label>
              <p className="font-medium">{person.email || "-"}</p>
            </div>
          </div>

          {/* Kişisel Bilgiler */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Doğum Tarihi
              </Label>
              <p className="font-medium">{formatDate(person.birthDate)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Hash className="w-3 h-3" /> Yaş
              </Label>
              <p className="font-medium">{person.age || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Droplet className="w-3 h-3" /> Kan Grubu
              </Label>
              <p className="font-medium">{person.bloodType || "-"}</p>
            </div>
          </div>

          {/* Beden Bilgileri */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Footprints className="w-3 h-3" /> Ayakkabı No
              </Label>
              <p className="font-medium">{person.shoeSize || "-"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Shirt className="w-3 h-3" /> Çorap Bedeni
              </Label>
              <p className="font-medium">{person.sockSize || "-"}</p>
            </div>
          </div>

          {/* Tarihler */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> İşe Giriş
              </Label>
              <p className="font-medium">{formatDate(person.hireDate)}</p>
            </div>
            {person.terminationDate && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Ayrılma Tarihi
                </Label>
                <p className="font-medium">
                  {formatDate(person.terminationDate)}
                </p>
              </div>
            )}
          </div>

          {person.terminationReason && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Ayrılma Nedeni
              </Label>
              <p className="font-medium text-destructive">
                {person.terminationReason}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== PERSONNEL FORM MODAL ====================

interface ToastFunctions {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface PersonnelFormModalProps {
  person: Personnel | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Personnel>) => Promise<void>;
  departments: string[];
  locations: string[];
  positions: string[];
  toast: ToastFunctions;
}

const PersonnelFormModal = ({
  person,
  open,
  onClose,
  onSave,
  departments,
  locations,
  positions,
  toast,
}: PersonnelFormModalProps) => {
  const [formData, setFormData] = useState<Partial<Personnel>>({});
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (person) {
      setFormData({ ...person });
      setAvatarPreview(getAvatarUrl(person.avatar) || null);
    } else {
      setFormData({
        status: "active",
        isActive: true,
      });
      setAvatarPreview(null);
    }
    setAvatarFile(null);
  }, [person, open]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.sicilNo || !formData.fullName || !formData.position) {
      toast.error("Sicil No, Ad Soyad ve Pozisyon zorunludur");
      return;
    }

    setSaving(true);
    try {
      // Avatar yükleme
      let avatarPath = formData.avatar;
      if (avatarFile && person?.id) {
        const res = await staffApi.uploadPersonnelAvatar(person.id, avatarFile);
        avatarPath = res.data.avatar;
      }

      await onSave({ ...formData, avatar: avatarPath });
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof Personnel, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {person ? "Personel Düzenle" : "Yeni Personel"}
          </DialogTitle>
          <DialogDescription>
            {person
              ? "Personel bilgilerini güncelleyin"
              : "Yeni personel kaydı oluşturun"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Temel</TabsTrigger>
            <TabsTrigger value="work">İş Bilgileri</TabsTrigger>
            <TabsTrigger value="personal">Kişisel</TabsTrigger>
            <TabsTrigger value="dates">Tarihler</TabsTrigger>
          </TabsList>

          {/* Temel Bilgiler */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar
                  className="h-20 w-20 border-2"
                  style={{ borderColor: formData.color || "#3b82f6" }}
                >
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="text-lg">
                    {formData.fullName ? (
                      getInitials(formData.fullName)
                    ) : (
                      <UserCircle className="w-8 h-8" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sicil No *</Label>
                  <Input
                    value={formData.sicilNo || ""}
                    onChange={(e) => updateField("sicilNo", e.target.value)}
                    placeholder="12345X"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Renk</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.color || "#3b82f6"}
                      onChange={(e) => updateField("color", e.target.value)}
                      className="w-12 h-9 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.color || "#3b82f6"}
                      onChange={(e) => updateField("color", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad Soyad *</Label>
                <Input
                  value={formData.fullName || ""}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="Ahmet Yılmaz"
                />
              </div>
              <div className="space-y-2">
                <Label>Pozisyon *</Label>
                <Select
                  value={formData.position || ""}
                  onValueChange={(v) => updateField("position", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pozisyon seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+90 5XX XXX XX XX"
                />
              </div>
              <div className="space-y-2">
                <Label>E-posta</Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Durum</Label>
              <Select
                value={formData.status || "active"}
                onValueChange={(v) => updateField("status", v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                  <SelectItem value="terminated">Ayrıldı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* İş Bilgileri */}
          <TabsContent value="work" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bölüm</Label>
                <Select
                  value={formData.department || ""}
                  onValueChange={(v) => updateField("department", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Bölüm seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Görev Yeri</Label>
                <Select
                  value={formData.workLocation || ""}
                  onValueChange={(v) => updateField("workLocation", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lokasyon seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Miço (Mentor)</Label>
              <Input
                value={formData.mentor || ""}
                onChange={(e) => updateField("mentor", e.target.value)}
                placeholder="Mentor adı"
              />
            </div>
          </TabsContent>

          {/* Kişisel Bilgiler */}
          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cinsiyet</Label>
                <Select
                  value={formData.gender || ""}
                  onValueChange={(v) => updateField("gender", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Erkek</SelectItem>
                    <SelectItem value="female">Kadın</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Doğum Tarihi</Label>
                <Input
                  type="date"
                  value={formData.birthDate?.split("T")[0] || ""}
                  onChange={(e) => updateField("birthDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Yaş</Label>
                <Input
                  type="number"
                  value={formData.age || ""}
                  onChange={(e) =>
                    updateField("age", parseInt(e.target.value) || undefined)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Kan Grubu</Label>
                <Select
                  value={formData.bloodType || ""}
                  onValueChange={(v) => updateField("bloodType", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ayakkabı No</Label>
                <Input
                  type="number"
                  value={formData.shoeSize || ""}
                  onChange={(e) =>
                    updateField(
                      "shoeSize",
                      parseInt(e.target.value) || undefined
                    )
                  }
                  placeholder="42"
                />
              </div>
              <div className="space-y-2">
                <Label>Çorap Bedeni</Label>
                <Select
                  value={formData.sockSize || ""}
                  onValueChange={(v) => updateField("sockSize", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCK_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Tarihler */}
          <TabsContent value="dates" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>İşe Giriş Tarihi</Label>
                <Input
                  type="date"
                  value={formData.hireDate?.split("T")[0] || ""}
                  onChange={(e) => updateField("hireDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Kıdem (Yıl)</Label>
                <Input
                  type="number"
                  value={formData.yearsAtCompany || ""}
                  onChange={(e) =>
                    updateField(
                      "yearsAtCompany",
                      parseInt(e.target.value) || undefined
                    )
                  }
                />
              </div>
            </div>

            {formData.status === "terminated" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ayrılma Tarihi</Label>
                    <Input
                      type="date"
                      value={formData.terminationDate?.split("T")[0] || ""}
                      onChange={(e) =>
                        updateField("terminationDate", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ayrılma Nedeni</Label>
                  <Input
                    value={formData.terminationReason || ""}
                    onChange={(e) =>
                      updateField("terminationReason", e.target.value)
                    }
                    placeholder="Ayrılma nedeni"
                  />
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              "Kaydet"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== CSV IMPORT MODAL ====================

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: Array<Record<string, string>>) => Promise<void>;
  toast: ToastFunctions;
}

const CSVImportModal = ({
  open,
  onClose,
  onImport,
  toast,
}: CSVImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // CSV parse
    const text = await selectedFile.text();
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      toast.error("CSV dosyası boş veya geçersiz");
      return;
    }

    // Header ve data ayır
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0]
      .split(delimiter)
      .map((h) => h.replace(/"/g, "").trim());
    const data: Array<Record<string, string>> = [];

    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const values = lines[i]
        .split(delimiter)
        .map((v) => v.replace(/"/g, "").trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      data.push(row);
    }

    setPreview(data);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0]
        .split(delimiter)
        .map((h) => h.replace(/"/g, "").trim());
      const data: Array<Record<string, string>> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]
          .split(delimiter)
          .map((v) => v.replace(/"/g, "").trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });
        if (row["Sicil No"] || row["İsim Soyisim"]) {
          data.push(row);
        }
      }

      await onImport(data);
      onClose();
      setFile(null);
      setPreview([]);
    } catch (error: any) {
      toast.error(error.message || "Import başarısız");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            CSV'den Personel İçe Aktar
          </DialogTitle>
          <DialogDescription>
            Excel veya CSV dosyasından personel verilerini içe aktarın
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dosya Seçimi */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">CSV dosyası seçin</p>
                <p className="text-sm text-muted-foreground">
                  veya sürükleyip bırakın
                </p>
              </div>
            )}
          </div>

          {/* Önizleme */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Önizleme (ilk 5 satır)</Label>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0])
                        .slice(0, 6)
                        .map((key) => (
                          <TableHead
                            key={key}
                            className="text-xs whitespace-nowrap"
                          >
                            {key}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx}>
                        {Object.values(row)
                          .slice(0, 6)
                          .map((val, vidx) => (
                            <TableCell key={vidx} className="text-xs">
                              {val || "-"}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Bilgi */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Beklenen Sütunlar:</p>
            <p className="text-muted-foreground">
              Sicil No, İsim Soyisim, Unvan, İşe Giriş Tarihi, Çalıştığı Bölüm,
              Miçolar, Görev Yeri, Kan Grubu, Cinsiyet, Ayakkabı Numarası, Kadın
              Çorap Bedenleri, Doğum Tarihi, Yaş, Kıdem, Durum
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={importing}>
            İptal
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                İçe Aktarılıyor...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                İçe Aktar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== DELETE CONFIRM MODAL ====================

interface DeleteConfirmModalProps {
  person: Personnel | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const DeleteConfirmModal = ({
  person,
  open,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!person) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Personeli Sil
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{person.fullName}</span> (
            {person.sicilNo}) kaydını silmek istediğinizden emin misiniz? Bu
            işlem geri alınamaz.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            İptal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Siliniyor...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==================== MAIN PAGE COMPONENT ====================

export default function PersonnelPage() {
  // Toast hook
  const toast = useToast();

  // State
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [stats, setStats] = useState<PersonnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<PersonnelFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [viewPerson, setViewPerson] = useState<Personnel | null>(null);
  const [editPerson, setEditPerson] = useState<Personnel | null>(null);
  const [deletePerson, setDeletePerson] = useState<Personnel | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Derived data
  const departments = useMemo(() => {
    const depts = new Set<string>();
    personnel.forEach((p) => p.department && depts.add(p.department));
    return Array.from(depts).sort();
  }, [personnel]);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    personnel.forEach((p) => p.workLocation && locs.add(p.workLocation));
    return Array.from(locs).sort();
  }, [personnel]);

  const positions = useMemo(() => {
    const pos = new Set<string>();
    personnel.forEach((p) => p.position && pos.add(p.position));
    return Array.from(pos).sort();
  }, [personnel]);

  // Filtered personnel
  const filteredPersonnel = useMemo(() => {
    return personnel.filter((p) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          p.fullName.toLowerCase().includes(q) ||
          p.sicilNo.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q) ||
          p.department?.toLowerCase().includes(q) ||
          p.workLocation?.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Filters
      if (filters.department && p.department !== filters.department)
        return false;
      if (filters.workLocation && p.workLocation !== filters.workLocation)
        return false;
      if (filters.position && p.position !== filters.position) return false;
      if (filters.status && p.status !== filters.status) return false;

      return true;
    });
  }, [personnel, searchQuery, filters]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [personnelRes, statsRes] = await Promise.all([
        staffApi.getPersonnel(),
        staffApi.getPersonnelStats(),
      ]);
      setPersonnel(personnelRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Veri yüklenemedi:", error);
      toast.error("Personel verileri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleSave = async (data: Partial<Personnel>) => {
    if (editPerson) {
      await staffApi.updatePersonnel(editPerson.id, data);
      toast.success("Personel güncellendi");
    } else {
      await staffApi.createPersonnel(data as any);
      toast.success("Personel oluşturuldu");
    }
    loadData();
  };

  const handleDelete = async () => {
    if (!deletePerson) return;
    await staffApi.deletePersonnel(deletePerson.id);
    toast.success("Personel silindi");
    loadData();
  };

  const handleImport = async (data: Array<Record<string, string>>) => {
    const res = await staffApi.importPersonnelCSV(data);
    toast.success(`${res.data.imported} personel içe aktarıldı`);
    loadData();
  };

  const handleExport = () => {
    // CSV export
    const headers = [
      "Sicil No",
      "Ad Soyad",
      "Pozisyon",
      "Bölüm",
      "Görev Yeri",
      "Telefon",
      "E-posta",
      "Durum",
    ];
    const rows = filteredPersonnel.map((p) => [
      p.sicilNo,
      p.fullName,
      p.position,
      p.department || "",
      p.workLocation || "",
      p.phone || "",
      p.email || "",
      STATUS_CONFIG[p.status]?.label || p.status,
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personel_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV dosyası indirildi");
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery("");
  };

  const hasActiveFilters = searchQuery || Object.values(filters).some(Boolean);

  return (
    <PageContainer>
      <PageHeader
        title="Personel Yönetimi"
        description="Tüm personel kayıtlarını görüntüleyin ve yönetin"
        icon={<Users className="w-6 h-6 text-blue-400" />}
      />
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Toplam Personel"
          value={stats?.total || 0}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          color="bg-blue-500/10"
        />
        <StatCard
          title="Aktif"
          value={stats?.active || 0}
          icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-500/10"
          subtitle={
            stats
              ? `%${Math.round((stats.active / stats.total) * 100)}`
              : undefined
          }
        />
        <StatCard
          title="Pasif"
          value={stats?.inactive || 0}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          color="bg-amber-500/10"
        />
        <StatCard
          title="Ayrılan"
          value={stats?.terminated || 0}
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          color="bg-red-500/10"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="İsim, sicil no, pozisyon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtrele
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 w-5 p-0 justify-center"
              >
                !
              </Badge>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                CSV İçe Aktar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                CSV Dışa Aktar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Yenile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Personel
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Bölüm</Label>
                <Select
                  value={filters.department || "all"}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      department: v === "all" ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Görev Yeri</Label>
                <Select
                  value={filters.workLocation || "all"}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      workLocation: v === "all" ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Pozisyon</Label>
                <Select
                  value={filters.position || "all"}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      position: v === "all" ? undefined : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {positions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Durum</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      status: v === "all" ? undefined : (v as any),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Pasif</SelectItem>
                    <SelectItem value="terminated">Ayrıldı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end mt-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Filtreleri Temizle
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPersonnel.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Personel bulunamadı</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasActiveFilters
                  ? "Filtreleri değiştirmeyi deneyin"
                  : "Yeni personel ekleyerek başlayın"}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={clearFilters}
                >
                  Filtreleri Temizle
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personel</TableHead>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead>Bölüm</TableHead>
                  <TableHead>Görev Yeri</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersonnel.map((person) => (
                  <PersonnelRow
                    key={person.id}
                    person={person}
                    onView={setViewPerson}
                    onEdit={(p) => {
                      setEditPerson(p);
                      setShowAddModal(true);
                    }}
                    onDelete={setDeletePerson}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Footer */}
        {!loading && filteredPersonnel.length > 0 && (
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            {filteredPersonnel.length} personel gösteriliyor
            {hasActiveFilters && ` (toplam ${personnel.length})`}
          </div>
        )}
      </Card>

      {/* Modals */}
      <PersonnelDetailModal
        person={viewPerson}
        open={!!viewPerson}
        onClose={() => setViewPerson(null)}
      />

      <PersonnelFormModal
        person={editPerson}
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditPerson(null);
        }}
        onSave={handleSave}
        departments={departments}
        locations={locations}
        positions={positions}
        toast={toast}
      />

      <DeleteConfirmModal
        person={deletePerson}
        open={!!deletePerson}
        onClose={() => setDeletePerson(null)}
        onConfirm={handleDelete}
      />

      <CSVImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        toast={toast}
      />
    </PageContainer>
  );
}
