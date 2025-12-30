"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Briefcase,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Users,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  positionsApi,
  departmentsApi,
  workLocationsApi,
  syncApi,
} from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface Position {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
}

interface WorkLocation {
  id: string;
  name: string;
  description?: string;
  address?: string;
  sortOrder: number;
  isActive: boolean;
}

interface DepartmentWithRelations {
  department: Department;
  positions: Position[];
  locations: WorkLocation[];
  staffCount: number;
}

export default function OrganizationManagementPage() {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("departments");
  const [loading, setLoading] = useState(true);

  // Data states
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [departmentsWithRelations, setDepartmentsWithRelations] = useState<
    DepartmentWithRelations[]
  >([]);

  // Modal states
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRelationsModal, setShowRelationsModal] = useState(false);

  // Edit states
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null
  );
  const [editingLocation, setEditingLocation] = useState<WorkLocation | null>(
    null
  );
  const [editingDeptRelations, setEditingDeptRelations] =
    useState<DepartmentWithRelations | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: string;
    item: any;
  } | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [posRes, deptRes, locRes, deptRelRes] = await Promise.all([
        positionsApi.getAll(true),
        departmentsApi.getAll(true),
        workLocationsApi.getAll(true),
        departmentsApi.getAllWithRelations(),
      ]);
      setPositions(posRes.data || []);
      setDepartments(deptRes.data || []);
      setWorkLocations(locRes.data || []);
      setDepartmentsWithRelations(deptRelRes.data || []);
    } catch (error) {
      console.error("Veri yüklenemedi:", error);
      toast.error("Veriler yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync relations from staff data
  const handleSyncRelations = async () => {
    try {
      setSyncing(true);
      const res = await syncApi.syncRelations();
      toast.success(
        `İlişkiler senkronize edildi: ${res.data.departmentPositions} pozisyon, ${res.data.departmentLocations} görev yeri`
      );
      loadData();
    } catch (error) {
      toast.error("Senkronizasyon başarısız");
    } finally {
      setSyncing(false);
    }
  };

  // Position CRUD
  const handleSavePosition = async (data: Partial<Position>) => {
    try {
      if (editingPosition?.id) {
        await positionsApi.update(editingPosition.id, data);
        toast.success("Unvan güncellendi");
      } else {
        await positionsApi.create(data as any);
        toast.success("Unvan eklendi");
      }
      setShowPositionModal(false);
      setEditingPosition(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "İşlem başarısız");
    }
  };

  const handleDeletePosition = async (id: string) => {
    try {
      await positionsApi.delete(id);
      toast.success("Unvan silindi");
      setDeleteConfirm(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Silme başarısız");
    }
  };

  // Department CRUD
  const handleSaveDepartment = async (data: Partial<Department>) => {
    try {
      if (editingDepartment?.id) {
        await departmentsApi.update(editingDepartment.id, data);
        toast.success("Bölüm güncellendi");
      } else {
        await departmentsApi.create(data as any);
        toast.success("Bölüm eklendi");
      }
      setShowDepartmentModal(false);
      setEditingDepartment(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "İşlem başarısız");
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      await departmentsApi.delete(id);
      toast.success("Bölüm silindi");
      setDeleteConfirm(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Silme başarısız");
    }
  };

  // Work Location CRUD
  const handleSaveLocation = async (data: Partial<WorkLocation>) => {
    try {
      if (editingLocation?.id) {
        await workLocationsApi.update(editingLocation.id, data);
        toast.success("Görev yeri güncellendi");
      } else {
        await workLocationsApi.create(data as any);
        toast.success("Görev yeri eklendi");
      }
      setShowLocationModal(false);
      setEditingLocation(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "İşlem başarısız");
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      await workLocationsApi.delete(id);
      toast.success("Görev yeri silindi");
      setDeleteConfirm(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Silme başarısız");
    }
  };

  // Update department relations
  const handleUpdateRelations = async (
    departmentId: string,
    positionIds: string[],
    locationIds: string[]
  ) => {
    try {
      await Promise.all([
        departmentsApi.updatePositions(departmentId, positionIds),
        departmentsApi.updateLocations(departmentId, locationIds),
      ]);
      toast.success("İlişkiler güncellendi");
      setShowRelationsModal(false);
      setEditingDeptRelations(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Güncelleme başarısız");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/settings")}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Organizasyon Yönetimi
              </h1>
              <p className="text-slate-400">
                Bölümler, unvanlar ve görev yerlerini yönetin
              </p>
            </div>
          </div>
          <Button
            onClick={handleSyncRelations}
            disabled={syncing}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`}
            />
            İlişkileri Senkronize Et
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {departments.length}
                  </p>
                  <p className="text-sm text-slate-400">Bölüm</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Briefcase className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {positions.length}
                  </p>
                  <p className="text-sm text-slate-400">Unvan</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <MapPin className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {workLocations.length}
                  </p>
                  <p className="text-sm text-slate-400">Görev Yeri</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {departmentsWithRelations.reduce(
                      (sum, d) => sum + d.staffCount,
                      0
                    )}
                  </p>
                  <p className="text-sm text-slate-400">Toplam Personel</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700 mb-4">
            <TabsTrigger
              value="departments"
              className="data-[state=active]:bg-blue-600"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Bölümler
            </TabsTrigger>
            <TabsTrigger
              value="positions"
              className="data-[state=active]:bg-green-600"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Unvanlar
            </TabsTrigger>
            <TabsTrigger
              value="locations"
              className="data-[state=active]:bg-orange-600"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Görev Yerleri
            </TabsTrigger>
          </TabsList>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Bölümler</CardTitle>
                <Button
                  onClick={() => {
                    setEditingDepartment(null);
                    setShowDepartmentModal(true);
                  }}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Bölüm
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">
                        Bölüm Adı
                      </TableHead>
                      <TableHead className="text-slate-400">
                        Pozisyonlar
                      </TableHead>
                      <TableHead className="text-slate-400">
                        Görev Yerleri
                      </TableHead>
                      <TableHead className="text-slate-400">Personel</TableHead>
                      <TableHead className="text-slate-400">Durum</TableHead>
                      <TableHead className="text-slate-400 text-right">
                        İşlemler
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentsWithRelations.map((item) => (
                      <TableRow
                        key={item.department.id}
                        className="border-slate-700"
                      >
                        <TableCell className="text-white font-medium">
                          {item.department.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.positions.slice(0, 3).map((p) => (
                              <Badge
                                key={p.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                {p.name}
                              </Badge>
                            ))}
                            {item.positions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{item.positions.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.locations.map((l) => (
                              <Badge
                                key={l.id}
                                variant="outline"
                                className="text-xs text-orange-400 border-orange-400/30"
                              >
                                {l.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {item.staffCount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.department.isActive ? "default" : "secondary"
                            }
                          >
                            {item.department.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingDeptRelations(item);
                                setShowRelationsModal(true);
                              }}
                              className="text-purple-400 hover:text-purple-300"
                            >
                              İlişkiler
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingDepartment(item.department);
                                setShowDepartmentModal(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "department",
                                  item: item.department,
                                })
                              }
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Unvanlar</CardTitle>
                <Button
                  onClick={() => {
                    setEditingPosition(null);
                    setShowPositionModal(true);
                  }}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Unvan
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">
                        Unvan Adı
                      </TableHead>
                      <TableHead className="text-slate-400">Açıklama</TableHead>
                      <TableHead className="text-slate-400">Sıra</TableHead>
                      <TableHead className="text-slate-400">Durum</TableHead>
                      <TableHead className="text-slate-400 text-right">
                        İşlemler
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((position) => (
                      <TableRow key={position.id} className="border-slate-700">
                        <TableCell className="text-white font-medium">
                          {position.name}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {position.description || "-"}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {position.sortOrder}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              position.isActive ? "default" : "secondary"
                            }
                          >
                            {position.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingPosition(position);
                                setShowPositionModal(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "position",
                                  item: position,
                                })
                              }
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white">Görev Yerleri</CardTitle>
                <Button
                  onClick={() => {
                    setEditingLocation(null);
                    setShowLocationModal(true);
                  }}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Görev Yeri
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">
                        Görev Yeri Adı
                      </TableHead>
                      <TableHead className="text-slate-400">Açıklama</TableHead>
                      <TableHead className="text-slate-400">Adres</TableHead>
                      <TableHead className="text-slate-400">Durum</TableHead>
                      <TableHead className="text-slate-400 text-right">
                        İşlemler
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workLocations.map((location) => (
                      <TableRow key={location.id} className="border-slate-700">
                        <TableCell className="text-white font-medium">
                          {location.name}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {location.description || "-"}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {location.address || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              location.isActive ? "default" : "secondary"
                            }
                          >
                            {location.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingLocation(location);
                                setShowLocationModal(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "location",
                                  item: location,
                                })
                              }
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Position Modal */}
      <PositionModal
        open={showPositionModal}
        onClose={() => {
          setShowPositionModal(false);
          setEditingPosition(null);
        }}
        position={editingPosition}
        onSave={handleSavePosition}
      />

      {/* Department Modal */}
      <DepartmentModal
        open={showDepartmentModal}
        onClose={() => {
          setShowDepartmentModal(false);
          setEditingDepartment(null);
        }}
        department={editingDepartment}
        onSave={handleSaveDepartment}
      />

      {/* Location Modal */}
      <LocationModal
        open={showLocationModal}
        onClose={() => {
          setShowLocationModal(false);
          setEditingLocation(null);
        }}
        location={editingLocation}
        onSave={handleSaveLocation}
      />

      {/* Relations Modal */}
      <RelationsModal
        open={showRelationsModal}
        onClose={() => {
          setShowRelationsModal(false);
          setEditingDeptRelations(null);
        }}
        departmentData={editingDeptRelations}
        allPositions={positions}
        allLocations={workLocations}
        onSave={handleUpdateRelations}
      />

      {/* Delete Confirm Modal */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Silme Onayı
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              <span className="font-semibold text-white">
                {deleteConfirm?.item?.name}
              </span>{" "}
              öğesini silmek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm?.type === "position") {
                  handleDeletePosition(deleteConfirm.item.id);
                } else if (deleteConfirm?.type === "department") {
                  handleDeleteDepartment(deleteConfirm.item.id);
                } else if (deleteConfirm?.type === "location") {
                  handleDeleteLocation(deleteConfirm.item.id);
                }
              }}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== POSITION MODAL ====================
function PositionModal({
  open,
  onClose,
  position,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  position: Position | null;
  onSave: (data: Partial<Position>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    if (position) {
      setFormData({
        name: position.name || "",
        description: position.description || "",
        sortOrder: position.sortOrder || 0,
        isActive: position.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        sortOrder: 0,
        isActive: true,
      });
    }
  }, [position, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-green-400" />
            {position ? "Unvan Düzenle" : "Yeni Unvan"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-slate-400">Unvan Adı *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="bg-slate-700 border-slate-600"
              placeholder="Örn: Şef"
            />
          </div>
          <div>
            <Label className="text-slate-400">Açıklama</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-slate-700 border-slate-600"
              placeholder="Unvan açıklaması"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400">Sıra</Label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sortOrder: parseInt(e.target.value) || 0,
                  })
                }
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label className="text-slate-400">Aktif</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700"
            disabled={saving || !formData.name.trim()}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {position ? "Güncelle" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== DEPARTMENT MODAL ====================
function DepartmentModal({
  open,
  onClose,
  department,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  department: Department | null;
  onSave: (data: Partial<Department>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || "",
        description: department.description || "",
        color: department.color || "#3b82f6",
        sortOrder: department.sortOrder || 0,
        isActive: department.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        color: "#3b82f6",
        sortOrder: 0,
        isActive: true,
      });
    }
  }, [department, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const colorOptions = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#6366f1",
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            {department ? "Bölüm Düzenle" : "Yeni Bölüm"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-slate-400">Bölüm Adı *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="bg-slate-700 border-slate-600"
              placeholder="Örn: Servis"
            />
          </div>
          <div>
            <Label className="text-slate-400">Açıklama</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-slate-700 border-slate-600"
              placeholder="Bölüm açıklaması"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-slate-400">Renk</Label>
            <div className="flex gap-2 mt-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formData.color === color
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400">Sıra</Label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sortOrder: parseInt(e.target.value) || 0,
                  })
                }
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label className="text-slate-400">Aktif</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saving || !formData.name.trim()}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {department ? "Güncelle" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== LOCATION MODAL ====================
function LocationModal({
  open,
  onClose,
  location,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  location: WorkLocation | null;
  onSave: (data: Partial<WorkLocation>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    sortOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name || "",
        description: location.description || "",
        address: location.address || "",
        sortOrder: location.sortOrder || 0,
        isActive: location.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        address: "",
        sortOrder: 0,
        isActive: true,
      });
    }
  }, [location, open]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-400" />
            {location ? "Görev Yeri Düzenle" : "Yeni Görev Yeri"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-slate-400">Görev Yeri Adı *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="bg-slate-700 border-slate-600"
              placeholder="Örn: Diamond Hotel"
            />
          </div>
          <div>
            <Label className="text-slate-400">Açıklama</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="bg-slate-700 border-slate-600"
              placeholder="Görev yeri açıklaması"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-slate-400">Adres</Label>
            <Textarea
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="bg-slate-700 border-slate-600"
              placeholder="Tam adres"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400">Sıra</Label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sortOrder: parseInt(e.target.value) || 0,
                  })
                }
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label className="text-slate-400">Aktif</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-orange-600 hover:bg-orange-700"
            disabled={saving || !formData.name.trim()}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {location ? "Güncelle" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== RELATIONS MODAL ====================
function RelationsModal({
  open,
  onClose,
  departmentData,
  allPositions,
  allLocations,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  departmentData: DepartmentWithRelations | null;
  allPositions: Position[];
  allLocations: WorkLocation[];
  onSave: (
    departmentId: string,
    positionIds: string[],
    locationIds: string[]
  ) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(
    new Set()
  );
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (departmentData) {
      setSelectedPositions(new Set(departmentData.positions.map((p) => p.id)));
      setSelectedLocations(new Set(departmentData.locations.map((l) => l.id)));
    } else {
      setSelectedPositions(new Set());
      setSelectedLocations(new Set());
    }
  }, [departmentData, open]);

  const togglePosition = (id: string) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleLocation = (id: string) => {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!departmentData) return;
    setSaving(true);
    try {
      await onSave(
        departmentData.department.id,
        Array.from(selectedPositions),
        Array.from(selectedLocations)
      );
    } finally {
      setSaving(false);
    }
  };

  if (!departmentData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            {departmentData.department.name} - İlişkiler
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Bu bölüme ait pozisyonları ve görev yerlerini seçin
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Positions */}
          <div>
            <Label className="text-slate-300 text-sm font-medium flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4 text-green-400" />
              Pozisyonlar ({selectedPositions.size} seçili)
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-slate-700/30 rounded-lg p-3">
              {allPositions
                .filter((p) => p.isActive)
                .map((position) => (
                  <label
                    key={position.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      selectedPositions.has(position.id)
                        ? "bg-green-500/20 border border-green-500/30"
                        : "bg-slate-700/50 hover:bg-slate-700"
                    }`}
                  >
                    <Checkbox
                      checked={selectedPositions.has(position.id)}
                      onCheckedChange={() => togglePosition(position.id)}
                    />
                    <span className="text-sm text-white">{position.name}</span>
                  </label>
                ))}
            </div>
          </div>

          {/* Locations */}
          <div>
            <Label className="text-slate-300 text-sm font-medium flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-orange-400" />
              Görev Yerleri ({selectedLocations.size} seçili)
            </Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-slate-700/30 rounded-lg p-3">
              {allLocations
                .filter((l) => l.isActive)
                .map((location) => (
                  <label
                    key={location.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      selectedLocations.has(location.id)
                        ? "bg-orange-500/20 border border-orange-500/30"
                        : "bg-slate-700/50 hover:bg-slate-700"
                    }`}
                  >
                    <Checkbox
                      checked={selectedLocations.has(location.id)}
                      onCheckedChange={() => toggleLocation(location.id)}
                    />
                    <span className="text-sm text-white">{location.name}</span>
                  </label>
                ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-700"
            disabled={saving}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
