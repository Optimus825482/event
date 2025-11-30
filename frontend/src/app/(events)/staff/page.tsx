"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Briefcase,
  UsersRound,
} from "lucide-react";
import { staffApi, uploadApi, API_BASE } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Görev tanımları
type StaffPosition = "supervizor" | "sef" | "garson" | "komi" | "debarasor";

const POSITION_LABELS: Record<StaffPosition, string> = {
  supervizor: "Süpervizör",
  sef: "Şef",
  garson: "Garson",
  komi: "Komi",
  debarasor: "Debarasör",
};

const POSITION_COLORS: Record<StaffPosition, string> = {
  supervizor: "bg-red-500/20 text-red-400 border-red-500/30",
  sef: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  garson: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  komi: "bg-green-500/20 text-green-400 border-green-500/30",
  debarasor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const getAvatarUrl = (avatar?: string): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) return avatar;
  return `${API_BASE}${avatar}`;
};

interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  color?: string;
  position?: StaffPosition;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
  members: Staff[];
  leaderId?: string;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Staff | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Personel listesini yükle
  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await staffApi.getAll();
      setStaff(response.data || []);
    } catch (error) {
      console.error("Personel listesi yüklenemedi:", error);
      // Mock data
      setStaff([
        {
          id: "1",
          fullName: "Ahmet Yılmaz",
          email: "ahmet@staff.com",
          phone: "555-0001",
          color: "#ef4444",
          position: "sef",
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          fullName: "Ayşe Demir",
          email: "ayse@staff.com",
          phone: "555-0002",
          color: "#22c55e",
          position: "garson",
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "3",
          fullName: "Mehmet Kaya",
          email: "mehmet@staff.com",
          phone: "555-0003",
          color: "#3b82f6",
          position: "garson",
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "4",
          fullName: "Fatma Şahin",
          email: "fatma@staff.com",
          phone: "555-0004",
          color: "#eab308",
          position: "komi",
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "5",
          fullName: "Ali Öztürk",
          email: "ali@staff.com",
          phone: "555-0005",
          color: "#8b5cf6",
          position: "supervizor",
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);
      setTeams([
        {
          id: "t1",
          name: "A Takımı",
          color: "#3b82f6",
          members: [],
          leaderId: "5",
        },
        {
          id: "t2",
          name: "B Takımı",
          color: "#22c55e",
          members: [],
          leaderId: "1",
        },
      ]);
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

  // Pozisyona göre grupla
  const groupedByPosition = filteredStaff.reduce((acc, person) => {
    const pos = person.position || "other";
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(person);
    return acc;
  }, {} as Record<string, Staff[]>);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await staffApi.delete(deleteConfirm.id);
      setStaff((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Silme hatası:", error);
    }
  };

  // İstatistikler
  const stats = {
    total: staff.length,
    active: staff.filter((s) => s.isActive).length,
    byPosition: Object.entries(POSITION_LABELS).map(([key, label]) => ({
      position: key,
      label,
      count: staff.filter((s) => s.position === key).length,
    })),
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Başlık */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-400" />
              Ekip Organizasyonu
            </h1>
            <p className="text-slate-400">Personel, rol ve ekip yönetimi</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTeamModal(true)}
              className="border-slate-600 bg-slate-800"
            >
              <UsersRound className="w-4 h-4 mr-2" />
              Ekip Oluştur
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Yeni Personel
            </Button>
          </div>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Toplam Personel</p>
            </CardContent>
          </Card>
          {stats.byPosition.map((item) => (
            <Card key={item.position} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white">{item.count}</p>
                <p className="text-xs text-slate-400">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="personnel" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger
              value="personnel"
              className="data-[state=active]:bg-purple-600"
            >
              <Users className="w-4 h-4 mr-2" />
              Personel Listesi
            </TabsTrigger>
            <TabsTrigger
              value="roles"
              className="data-[state=active]:bg-purple-600"
            >
              <Shield className="w-4 h-4 mr-2" />
              Rol Tanımları
            </TabsTrigger>
            <TabsTrigger
              value="teams"
              className="data-[state=active]:bg-purple-600"
            >
              <UsersRound className="w-4 h-4 mr-2" />
              Ekipler
            </TabsTrigger>
          </TabsList>

          {/* Personel Listesi Tab */}
          <TabsContent value="personnel" className="mt-6 space-y-4">
            {/* Filtreler */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Personel ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
              </div>
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700">
                  <Briefcase className="w-4 h-4 mr-2" />
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

            {/* Personel Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-14 h-14 rounded-full bg-slate-700" />
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
                <p className="text-slate-400 mb-4">Personel bulunamadı</p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-purple-600"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  İlk Personeli Ekle
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredStaff.map((person) => (
                  <Card
                    key={person.id}
                    className={`bg-slate-800 border-slate-700 overflow-hidden ${
                      !person.isActive && "opacity-60"
                    }`}
                  >
                    <div
                      className={`h-1 ${
                        person.isActive ? "bg-green-500" : "bg-slate-600"
                      }`}
                    />
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar
                          className="w-14 h-14 border-2"
                          style={{ borderColor: person.color || "#3b82f6" }}
                        >
                          <AvatarImage
                            src={getAvatarUrl(person.avatar)}
                            alt={person.fullName}
                          />
                          <AvatarFallback
                            style={{
                              backgroundColor: person.color || "#3b82f6",
                            }}
                            className="text-white font-bold text-lg"
                          >
                            {person.fullName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">
                            {person.fullName}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {person.position && (
                              <Badge
                                variant="outline"
                                className={POSITION_COLORS[person.position]}
                              >
                                {POSITION_LABELS[person.position]}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-slate-400 mb-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{person.email}</span>
                        </div>
                        {person.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 flex-shrink-0" />
                            <span>{person.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-slate-600 bg-slate-700"
                          onClick={() => setEditingStaff(person)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Düzenle
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-red-500/30 bg-red-500/10 text-red-400"
                          onClick={() => setDeleteConfirm(person)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Rol Tanımları Tab */}
          <TabsContent value="roles" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(POSITION_LABELS).map(([key, label]) => {
                const positionStaff = staff.filter((s) => s.position === key);
                return (
                  <Card key={key} className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="text-white">{label}</span>
                        <Badge
                          variant="outline"
                          className={POSITION_COLORS[key as StaffPosition]}
                        >
                          {positionStaff.length} kişi
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400 mb-4">
                        {key === "supervizor" &&
                          "Tüm operasyonu denetler ve koordine eder"}
                        {key === "sef" && "Mutfak ve servis ekibini yönetir"}
                        {key === "garson" && "Misafirlere servis yapar"}
                        {key === "komi" && "Garsonlara yardımcı olur"}
                        {key === "debarasor" &&
                          "Masa temizliği ve düzeni sağlar"}
                      </p>
                      {positionStaff.length > 0 && (
                        <div className="flex -space-x-2">
                          {positionStaff.slice(0, 5).map((person) => (
                            <Tooltip key={person.id}>
                              <TooltipTrigger>
                                <Avatar className="w-8 h-8 border-2 border-slate-800">
                                  <AvatarImage
                                    src={getAvatarUrl(person.avatar)}
                                  />
                                  <AvatarFallback
                                    style={{ backgroundColor: person.color }}
                                    className="text-white text-xs"
                                  >
                                    {person.fullName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>{person.fullName}</TooltipContent>
                            </Tooltip>
                          ))}
                          {positionStaff.length > 5 && (
                            <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs text-slate-400">
                              +{positionStaff.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Ekipler Tab */}
          <TabsContent value="teams" className="mt-6">
            {teams.length === 0 ? (
              <div className="text-center py-12">
                <UsersRound className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 mb-4">Henüz ekip oluşturulmamış</p>
                <Button
                  onClick={() => setShowTeamModal(true)}
                  className="bg-purple-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  İlk Ekibi Oluştur
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => {
                  const leader = staff.find((s) => s.id === team.leaderId);
                  return (
                    <Card
                      key={team.id}
                      className="bg-slate-800 border-slate-700 overflow-hidden"
                    >
                      <div
                        className="h-1"
                        style={{ backgroundColor: team.color }}
                      />
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span className="text-white">{team.name}</span>
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {leader && (
                          <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-slate-700/50">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={getAvatarUrl(leader.avatar)} />
                              <AvatarFallback
                                style={{ backgroundColor: leader.color }}
                                className="text-white text-xs"
                              >
                                {leader.fullName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {leader.fullName}
                              </p>
                              <p className="text-xs text-slate-400">
                                Ekip Lideri
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">
                            {team.members.length} üye
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-600"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Düzenle
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {/* Yeni Ekip Kartı */}
                <Card
                  className="bg-slate-800/50 border-slate-700 border-dashed cursor-pointer"
                  onClick={() => setShowTeamModal(true)}
                >
                  <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[200px]">
                    <Plus className="w-10 h-10 text-slate-500 mb-2" />
                    <p className="text-slate-400">Yeni Ekip Oluştur</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Modal */}
        <StaffFormDialog
          open={showCreateModal || !!editingStaff}
          staff={editingStaff}
          onClose={() => {
            setShowCreateModal(false);
            setEditingStaff(null);
          }}
          onSave={() => {
            loadStaff();
            setShowCreateModal(false);
            setEditingStaff(null);
          }}
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
                <strong>{deleteConfirm?.fullName}</strong> isimli personeli
                silmek istediğinizden emin misiniz?
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

        {/* Team Modal */}
        <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Yeni Ekip Oluştur</DialogTitle>
              <DialogDescription className="text-slate-400">
                Ekip bilgilerini girin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Ekip Adı</Label>
                <Input
                  placeholder="Örn: A Takımı"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Ekip Rengi</Label>
                <div className="flex gap-2">
                  {[
                    "#ef4444",
                    "#22c55e",
                    "#3b82f6",
                    "#eab308",
                    "#8b5cf6",
                    "#f97316",
                  ].map((color) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded-full border-2 border-transparent"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ekip Lideri</Label>
                <Select>
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Lider seçin" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {staff
                      .filter(
                        (s) =>
                          s.position === "supervizor" || s.position === "sef"
                      )
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowTeamModal(false)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button className="bg-purple-600">Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
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
    phone: "",
    password: "",
    color: "#3b82f6",
    position: "" as StaffPosition | "",
    avatar: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (staff) {
      setFormData({
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone || "",
        password: "",
        color: staff.color || "#3b82f6",
        position: staff.position || "",
        avatar: staff.avatar || "",
        isActive: staff.isActive,
      });
      setAvatarPreview(staff.avatar || "");
    } else {
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        color: "#3b82f6",
        position: "",
        avatar: "",
        isActive: true,
      });
      setAvatarPreview("");
    }
    setError("");
  }, [staff, open]);

  const colors = [
    "#ef4444",
    "#22c55e",
    "#3b82f6",
    "#eab308",
    "#8b5cf6",
    "#f97316",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
    "#f59e0b",
  ];

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setError("Sadece JPG ve PNG dosyaları kabul edilir");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Fotoğraf 5MB'dan küçük olmalıdır");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const response = await uploadApi.uploadAvatar(file);
      const { urls } = response.data.data;
      setAvatarPreview(urls.medium);
      setFormData((prev) => ({ ...prev, avatar: urls.medium }));
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Fotoğraf yüklenirken hata oluştu"
      );
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
    if (!staff && !formData.email.trim()) {
      setError("Email zorunludur");
      return;
    }
    if (!staff && !formData.password) {
      setError("Şifre zorunludur");
      return;
    }
    if (!formData.position) {
      setError("Görev seçimi zorunludur");
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
          isActive: formData.isActive,
        });
      } else {
        await staffApi.create({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || undefined,
          color: formData.color,
          position: formData.position || undefined,
          avatar: formData.avatar || undefined,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {staff ? "Personel Düzenle" : "Yeni Personel"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {staff
              ? "Personel bilgilerini güncelleyin"
              : "Yeni bir personel ekleyin"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar
                className="w-20 h-20 border-4"
                style={{ borderColor: formData.color }}
              >
                <AvatarImage src={getAvatarUrl(avatarPreview)} />
                <AvatarFallback
                  style={{ backgroundColor: formData.color }}
                  className="text-white font-bold text-2xl"
                >
                  {formData.fullName
                    ? formData.fullName.charAt(0).toUpperCase()
                    : "?"}
                </AvatarFallback>
              </Avatar>
              <label
                className={`absolute bottom-0 right-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center ${
                  uploading ? "opacity-50 cursor-wait" : "cursor-pointer"
                }`}
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ad Soyad *</Label>
            <Input
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              placeholder="Örn: Ahmet Yılmaz"
              className="bg-slate-700 border-slate-600"
            />
          </div>
          {!staff && (
            <>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="ornek@email.com"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Şifre *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="555-000-0000"
              className="bg-slate-700 border-slate-600"
            />
          </div>
          <div className="space-y-2">
            <Label>Görev *</Label>
            <Select
              value={formData.position}
              onValueChange={(v) =>
                setFormData({ ...formData, position: v as StaffPosition })
              }
            >
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Görev seçin" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="supervizor">Süpervizör</SelectItem>
                <SelectItem value="sef">Şef</SelectItem>
                <SelectItem value="garson">Garson</SelectItem>
                <SelectItem value="komi">Komi</SelectItem>
                <SelectItem value="debarasor">Debarasör</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Renk</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                    formData.color === color
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {formData.color === color && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
          {staff && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="w-4 h-4 rounded"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Aktif
              </Label>
            </div>
          )}
          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button type="submit" disabled={saving} className="bg-purple-600">
              {saving ? "Kaydediliyor..." : staff ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
