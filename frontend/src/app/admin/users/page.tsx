"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Filter,
  Key,
  Loader2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usersApi, API_BASE, leaderApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";

interface User {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role:
    | "admin"
    | "organizer"
    | "leader"
    | "staff"
    | "venue_owner"
    | "controller";
  position?: string;
  color?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface UserStats {
  total: number;
  active: number;
  byRole: Record<string, number>;
}

interface StaffReview {
  id: string;
  staffId: string;
  eventId: string;
  reviewerId: string;
  overallScore: number;
  punctualityScore: number;
  attitudeScore: number;
  teamworkScore: number;
  efficiencyScore: number;
  comment?: string;
  isCompleted: boolean;
  createdAt: string;
  event?: { id: string; name: string; eventDate: string };
  reviewer?: { id: string; fullName: string };
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> =
  {
    admin: {
      label: "Admin",
      color: "text-amber-400",
      bg: "bg-amber-500/20 border-amber-500/30",
    },
    organizer: {
      label: "Organizatör",
      color: "text-blue-400",
      bg: "bg-blue-500/20 border-blue-500/30",
    },
    leader: {
      label: "Lider",
      color: "text-cyan-400",
      bg: "bg-cyan-500/20 border-cyan-500/30",
    },
    staff: {
      label: "Personel",
      color: "text-green-400",
      bg: "bg-green-500/20 border-green-500/30",
    },
    venue_owner: {
      label: "Mekan Sahibi",
      color: "text-purple-400",
      bg: "bg-purple-500/20 border-purple-500/30",
    },
    controller: {
      label: "Controller",
      color: "text-orange-400",
      bg: "bg-orange-500/20 border-orange-500/30",
    },
  };

type SortField =
  | "username"
  | "fullName"
  | "email"
  | "role"
  | "position"
  | "isActive"
  | "createdAt";
type SortDirection = "asc" | "desc";

type UserRole =
  | "admin"
  | "organizer"
  | "leader"
  | "staff"
  | "venue_owner"
  | "controller";

interface FormData {
  username: string;
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  position: string;
}

const initialFormData: FormData = {
  username: "",
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role: "staff",
  position: "",
};

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<User | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [newPassword, setNewPassword] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [reviewsUser, setReviewsUser] = useState<User | null>(null);
  const [staffReviews, setStaffReviews] = useState<StaffReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        usersApi.getAll(),
        usersApi.getStats(),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (error: any) {
      console.error("Kullanıcılar yüklenemedi:", error);
      toast.error("Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filtreleme ve sıralama
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Arama filtresi
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.fullName.toLowerCase().includes(query) ||
          (user.username && user.username.toLowerCase().includes(query)) ||
          (user.email && user.email.toLowerCase().includes(query)) ||
          (user.phone && user.phone.includes(query)) ||
          (user.position && user.position.toLowerCase().includes(query))
      );
    }

    // Rol filtresi
    if (roleFilter !== "all") {
      result = result.filter((user) => user.role === roleFilter);
    }

    // Durum filtresi
    if (statusFilter !== "all") {
      result = result.filter((user) =>
        statusFilter === "active" ? user.isActive : !user.isActive
      );
    }

    // Sıralama
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "isActive") {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, searchQuery, roleFilter, statusFilter, sortField, sortDirection]);

  // Sayfalama
  const totalPages = Math.ceil(filteredAndSortedUsers.length / pageSize);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedUsers.slice(start, start + pageSize);
  }, [filteredAndSortedUsers, currentPage, pageSize]);

  // Sayfa değiştiğinde başa dön
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronsUpDown className="w-4 h-4 text-slate-500" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4 text-blue-400" />
    ) : (
      <ChevronDown className="w-4 h-4 text-blue-400" />
    );
  };

  const handleCreate = async () => {
    if (!formData.username || !formData.fullName || !formData.password) {
      toast.error("Kullanıcı adı, ad soyad ve şifre zorunludur");
      return;
    }
    try {
      setSaving(true);
      await usersApi.create({
        username: formData.username,
        fullName: formData.fullName,
        email: formData.email || undefined,
        password: formData.password,
        role: formData.role,
        phone: formData.phone || undefined,
        position: formData.position || undefined,
      });
      toast.success("Kullanıcı oluşturuldu");
      setShowCreateModal(false);
      setFormData(initialFormData);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Kullanıcı oluşturulamadı");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    if (!formData.username || !formData.fullName) {
      toast.error("Kullanıcı adı ve ad soyad zorunludur");
      return;
    }
    try {
      setSaving(true);
      await usersApi.update(editingUser.id, {
        username: formData.username,
        fullName: formData.fullName,
        email: formData.email || undefined,
        role: formData.role,
        phone: formData.phone || undefined,
        position: formData.position || undefined,
      });

      // Şifre değişikliği varsa ayrıca güncelle
      if (formData.password && formData.password.length >= 6) {
        await usersApi.changePassword(editingUser.id, {
          newPassword: formData.password,
        });
      }

      toast.success("Kullanıcı güncellendi");
      setEditingUser(null);
      setFormData(initialFormData);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Kullanıcı güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setSaving(true);
      await usersApi.delete(deleteConfirm.id);
      toast.success("Kullanıcı silindi");
      setDeleteConfirm(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Kullanıcı silinemedi");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      await usersApi.toggleStatus(user.id);
      toast.success(
        user.isActive ? "Kullanıcı pasif yapıldı" : "Kullanıcı aktif yapıldı"
      );
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Durum değiştirilemedi");
    }
  };

  const handleChangePassword = async () => {
    if (!showPasswordModal || !newPassword) {
      toast.error("Yeni şifre giriniz");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır");
      return;
    }
    try {
      setSaving(true);
      await usersApi.changePassword(showPasswordModal.id, { newPassword });
      toast.success("Şifre değiştirildi");
      setShowPasswordModal(null);
      setNewPassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Şifre değiştirilemedi");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user: User) => {
    setFormData({
      username: user.username || "",
      fullName: user.fullName,
      email: user.email || "",
      password: "",
      phone: user.phone || "",
      role: user.role,
      position: user.position || "",
    });
    setEditingUser(user);
  };

  const handleMigrateUsernames = async () => {
    try {
      setMigrating(true);
      const res = await usersApi.migrateUsernames();
      toast.success(
        `Username migration tamamlandı: ${res.data.migrated} güncellendi, ${res.data.skipped} atlandı`
      );
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Migration başarısız");
    } finally {
      setMigrating(false);
    }
  };

  const loadStaffReviews = async (user: User) => {
    setReviewsUser(user);
    setLoadingReviews(true);
    try {
      const res = await leaderApi.getStaffReviews(user.id);
      setStaffReviews(res.data || []);
    } catch (error: any) {
      toast.error("Değerlendirmeler yüklenemedi");
      setStaffReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const calculateAverageScore = (reviews: StaffReview[]) => {
    if (reviews.length === 0) return 0;
    const completedReviews = reviews.filter((r) => r.isCompleted);
    if (completedReviews.length === 0) return 0;
    const total = completedReviews.reduce((sum, r) => sum + r.overallScore, 0);
    return (total / completedReviews.length).toFixed(1);
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "text-green-400";
    if (score >= 3.5) return "text-blue-400";
    if (score >= 2.5) return "text-amber-400";
    return "text-red-400";
  };

  // Username'i olmayan kullanıcı sayısı
  const usersWithoutUsername = users.filter((u) => !u.username).length;

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 bg-slate-700 rounded" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-4">
        <Breadcrumb />

        <PageHeader
          title="Kullanıcı Yönetimi"
          description={
            stats ? `${stats.total} kullanıcı, ${stats.active} aktif` : ""
          }
          icon={<Users className="w-6 h-6 text-blue-400" />}
          actions={
            <div className="flex gap-2">
              {usersWithoutUsername > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMigrateUsernames}
                  disabled={migrating}
                  className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                >
                  {migrating ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-1" />
                  )}
                  {usersWithoutUsername} Kullanıcıya Username Ata
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsers}
                className="border-slate-600"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setFormData(initialFormData);
                  setShowCreateModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Yeni Kullanıcı
              </Button>
            </div>
          }
        />

        {/* İstatistik Kartları */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-white">
                  {stats.total}
                </div>
                <div className="text-xs text-slate-400">Toplam</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {stats.active}
                </div>
                <div className="text-xs text-slate-400">Aktif</div>
              </CardContent>
            </Card>
            {Object.entries(stats.byRole).map(([role, count]) => (
              <Card key={role} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-3 text-center">
                  <div
                    className={`text-2xl font-bold ${
                      roleConfig[role]?.color || "text-white"
                    }`}
                  >
                    {count}
                  </div>
                  <div className="text-xs text-slate-400">
                    {roleConfig[role]?.label || role}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filtreler */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Kullanıcı adı, ad, email, telefon veya pozisyon ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 h-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 h-9">
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Tüm Roller</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="organizer">Organizatör</SelectItem>
              <SelectItem value="leader">Lider</SelectItem>
              <SelectItem value="staff">Personel</SelectItem>
              <SelectItem value="venue_owner">Mekan Sahibi</SelectItem>
              <SelectItem value="controller">Controller</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] bg-slate-800 border-slate-700 h-9">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => setPageSize(Number(v))}
          >
            <SelectTrigger className="w-[100px] bg-slate-800 border-slate-700 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-400">
            {filteredAndSortedUsers.length} sonuç
          </span>
        </div>

        {/* DataTable */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="text-left p-3">
                    <button
                      onClick={() => handleSort("username")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Kullanıcı Adı <SortIcon field="username" />
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button
                      onClick={() => handleSort("fullName")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Ad Soyad <SortIcon field="fullName" />
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button
                      onClick={() => handleSort("email")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      E-posta <SortIcon field="email" />
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button
                      onClick={() => handleSort("role")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Rol <SortIcon field="role" />
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button
                      onClick={() => handleSort("position")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Pozisyon <SortIcon field="position" />
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button
                      onClick={() => handleSort("isActive")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Durum <SortIcon field="isActive" />
                    </button>
                  </th>
                  <th className="text-left p-3">
                    <button
                      onClick={() => handleSort("createdAt")}
                      className="flex items-center gap-1 text-slate-300 hover:text-white"
                    >
                      Kayıt <SortIcon field="createdAt" />
                    </button>
                  </th>
                  <th className="text-right p-3 text-slate-300">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-500">
                      Kullanıcı bulunamadı
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                      onClick={() =>
                        (user.role === "staff" || user.role === "leader") &&
                        loadStaffReviews(user)
                      }
                    >
                      <td className="p-3">
                        <span className="text-blue-400 font-mono text-sm">
                          {user.username || "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            {user.avatar && (
                              <AvatarImage src={`${API_BASE}${user.avatar}`} />
                            )}
                            <AvatarFallback
                              className="text-xs text-white"
                              style={{
                                backgroundColor: user.color || "#3b82f6",
                              }}
                            >
                              {user.fullName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white font-medium">
                            {user.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-400">
                        {user.email || "-"}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`${roleConfig[user.role]?.bg} ${
                            roleConfig[user.role]?.color
                          } text-xs`}
                        >
                          {roleConfig[user.role]?.label || user.role}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-400 capitalize">
                        {user.position || "-"}
                      </td>
                      <td className="p-3">
                        {user.isActive ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                            Pasif
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 text-xs">
                        {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-slate-800 border-slate-700"
                          >
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(user);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-2" /> Düzenle
                            </DropdownMenuItem>
                            {(user.role === "staff" ||
                              user.role === "leader") && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadStaffReviews(user);
                                }}
                              >
                                <Star className="w-4 h-4 mr-2" />{" "}
                                Değerlendirmeler
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPasswordModal(user);
                              }}
                            >
                              <Key className="w-4 h-4 mr-2" /> Şifre Değiştir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUserStatus(user);
                              }}
                            >
                              {user.isActive ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-2" /> Pasif Yap
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />{" "}
                                  Aktif Yap
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(user);
                              }}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Sil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-slate-700">
              <span className="text-sm text-slate-400">
                Sayfa {currentPage} / {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="border-slate-600 h-8"
                >
                  İlk
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-slate-600 h-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={
                        currentPage === page
                          ? "bg-blue-600 h-8"
                          : "border-slate-600 h-8"
                      }
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-slate-600 h-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="border-slate-600 h-8"
                >
                  Son
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Dialog
          open={showCreateModal || !!editingUser}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateModal(false);
              setEditingUser(null);
              setFormData(initialFormData);
            }
          }}
        >
          <DialogContent className="bg-slate-800 border-slate-700 !max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingUser
                  ? "Kullanıcı bilgilerini güncelleyin"
                  : "Yeni bir kullanıcı oluşturun"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kullanıcı Adı *</Label>
                  <Input
                    placeholder="kullanici_adi"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ad Soyad *</Label>
                  <Input
                    placeholder="Ad Soyad"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v: UserRole) =>
                      setFormData({ ...formData, role: v })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="organizer">Organizatör</SelectItem>
                      <SelectItem value="leader">Lider</SelectItem>
                      <SelectItem value="staff">Personel</SelectItem>
                      <SelectItem value="venue_owner">Mekan Sahibi</SelectItem>
                      <SelectItem value="controller">Controller</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    placeholder="05XX XXX XX XX"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pozisyon</Label>
                  <Input
                    placeholder="Örn: Şef, Garson"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>
              {!editingUser && (
                <div className="space-y-2">
                  <Label>Şifre *</Label>
                  <Input
                    type="password"
                    placeholder="En az 6 karakter"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              )}
              {editingUser && (
                <div className="space-y-2">
                  <Label>Yeni Şifre (opsiyonel)</Label>
                  <Input
                    type="password"
                    placeholder="Değiştirmek için yeni şifre girin"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingUser(null);
                }}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={editingUser ? handleUpdate : handleCreate}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingUser ? "Güncelle" : "Oluştur"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Modal */}
        <Dialog
          open={!!showPasswordModal}
          onOpenChange={() => setShowPasswordModal(null)}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Şifre Değiştir</DialogTitle>
              <DialogDescription className="text-slate-400">
                <strong>{showPasswordModal?.fullName}</strong> için yeni şifre
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Yeni Şifre</Label>
                <Input
                  type="password"
                  placeholder="En az 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordModal(null);
                  setNewPassword("");
                }}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Değiştir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Kullanıcıyı Sil</DialogTitle>
              <DialogDescription className="text-slate-400">
                <strong>{deleteConfirm?.fullName}</strong> kullanıcısını silmek
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
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Staff Reviews Modal */}
        <Dialog
          open={!!reviewsUser}
          onOpenChange={() => {
            setReviewsUser(null);
            setStaffReviews([]);
          }}
        >
          <DialogContent className="bg-slate-800 border-slate-700 !max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  {reviewsUser?.avatar && (
                    <AvatarImage src={`${API_BASE}${reviewsUser.avatar}`} />
                  )}
                  <AvatarFallback
                    className="text-white"
                    style={{ backgroundColor: reviewsUser?.color || "#3b82f6" }}
                  >
                    {reviewsUser?.fullName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-white">{reviewsUser?.fullName}</span>
                  <p className="text-sm text-slate-400 font-normal">
                    {reviewsUser?.position || "Personel"} • Değerlendirme
                    Geçmişi
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>

            {loadingReviews ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            ) : staffReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Star className="w-12 h-12 mb-3 opacity-30" />
                <p>Henüz değerlendirme yapılmamış</p>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Genel Özet */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div
                      className={`text-2xl font-bold ${getScoreColor(
                        Number(calculateAverageScore(staffReviews))
                      )}`}
                    >
                      {calculateAverageScore(staffReviews)}
                    </div>
                    <div className="text-xs text-slate-400">Genel Ortalama</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {staffReviews.filter((r) => r.isCompleted).length}
                    </div>
                    <div className="text-xs text-slate-400">Tamamlanan</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {
                        new Set(
                          staffReviews
                            .filter((r) => r.isCompleted)
                            .map((r) => r.eventId)
                        ).size
                      }
                    </div>
                    <div className="text-xs text-slate-400">Etkinlik</div>
                  </div>
                </div>

                {/* Değerlendirme Listesi */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {staffReviews
                    .filter((r) => r.isCompleted)
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((review) => (
                      <div
                        key={review.id}
                        className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-white">
                                {review.event?.name || "Etkinlik"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {review.event?.eventDate
                                ? new Date(
                                    review.event.eventDate
                                  ).toLocaleDateString("tr-TR")
                                : ""}{" "}
                              • Değerlendiren:{" "}
                              {review.reviewer?.fullName || "Bilinmiyor"}
                            </div>
                          </div>
                          <div
                            className={`text-2xl font-bold ${getScoreColor(
                              review.overallScore
                            )}`}
                          >
                            {review.overallScore.toFixed(1)}
                          </div>
                        </div>

                        {/* Detay Puanlar */}
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="text-center">
                            <div className="text-sm font-medium text-slate-300">
                              {review.punctualityScore}
                            </div>
                            <div className="text-xs text-slate-500">
                              Dakiklik
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-slate-300">
                              {review.attitudeScore}
                            </div>
                            <div className="text-xs text-slate-500">Tutum</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-slate-300">
                              {review.teamworkScore}
                            </div>
                            <div className="text-xs text-slate-500">Takım</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-slate-300">
                              {review.efficiencyScore}
                            </div>
                            <div className="text-xs text-slate-500">
                              Verimlilik
                            </div>
                          </div>
                        </div>

                        {review.comment && (
                          <div className="bg-slate-800/50 rounded p-2 text-sm text-slate-400 italic">
                            &quot;{review.comment}&quot;
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setReviewsUser(null);
                  setStaffReviews([]);
                }}
                className="border-slate-600"
              >
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
