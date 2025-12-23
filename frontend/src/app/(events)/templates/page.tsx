"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  MapPin,
  LayoutGrid,
  Users,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  Search,
  X,
} from "lucide-react";
import { venuesApi, staffApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VenueTemplate {
  id: string;
  name: string;
  description?: string;
  layoutData: any;
  isPublic: boolean;
  thumbnail?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationTemplate {
  id: string;
  name: string;
  description?: string;
  staffAssignments: any[];
  teamAssignments: any[];
  tableGroups: any[];
  tags: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlacedTable {
  id: string;
  x: number;
  y: number;
  tableNumber: number;
  isLoca: boolean;
  capacity: number;
  type?: string;
  locaName?: string;
}

export default function TemplatesPage() {
  const [venueTemplates, setVenueTemplates] = useState<VenueTemplate[]>([]);
  const [orgTemplates, setOrgTemplates] = useState<OrganizationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "venue" | "org";
    id: string;
    name: string;
  } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<VenueTemplate | null>(
    null
  );
  const [previewOrgTemplate, setPreviewOrgTemplate] =
    useState<OrganizationTemplate | null>(null);
  const [placedTablesForOrg, setPlacedTablesForOrg] = useState<PlacedTable[]>(
    []
  );
  const [stageElementsForOrg, setStageElementsForOrg] = useState<any[]>([]);
  const [teamsData, setTeamsData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [venuesRes, orgRes, teamsRes] = await Promise.all([
          venuesApi.getAll().catch(() => ({ data: [] })),
          staffApi.getOrganizationTemplates().catch(() => ({ data: [] })),
          staffApi.getTeams().catch(() => ({ data: [] })),
        ]);

        const venues = Array.isArray(venuesRes.data)
          ? venuesRes.data
          : venuesRes.data || [];
        const orgs = Array.isArray(orgRes.data)
          ? orgRes.data
          : orgRes.data || [];
        const teams = Array.isArray(teamsRes.data)
          ? teamsRes.data
          : teamsRes.data || [];

        setVenueTemplates(venues);
        setOrgTemplates(orgs);
        setTeamsData(teams);
      } catch (error) {
        console.error("Şablonlar yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeleteVenue = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "venue") return;
    try {
      await venuesApi.delete(deleteConfirm.id);
      setVenueTemplates((prev) =>
        prev.filter((t) => t.id !== deleteConfirm.id)
      );
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Silme hatası:", error);
    }
  };

  const handleDeleteOrg = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "org") return;
    try {
      await staffApi.deleteOrganizationTemplate(deleteConfirm.id);
      setOrgTemplates((prev) => prev.filter((t) => t.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Silme hatası:", error);
    }
  };

  const filteredVenues = venueTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredOrgs = orgTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <TemplatesSkeleton />;

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-amber-400" />
              Şablonlar
            </h1>
            <p className="text-slate-400 mt-1">
              Yerleşim ve ekip atama şablonlarını yönetin
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Şablon ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64 bg-slate-800 border-slate-700"
            />
          </div>
        </div>

        <Tabs defaultValue="venue" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger
              value="venue"
              className="data-[state=active]:bg-green-600"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Yerleşim Şablonları ({filteredVenues.length})
            </TabsTrigger>
            <TabsTrigger
              value="organization"
              className="data-[state=active]:bg-amber-600"
            >
              <Users className="w-4 h-4 mr-2" />
              Ekip Atama Şablonları ({filteredOrgs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="venue" className="mt-6">
            {filteredVenues.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-12 h-12" />}
                title="Yerleşim şablonu yok"
                description="Etkinlik alanı oluştururken şablon olarak kaydedebilirsiniz"
                actionLabel="Etkinliklere Git"
                actionHref="/events"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVenues.map((template) => (
                  <VenueTemplateCard
                    key={template.id}
                    template={template}
                    onDelete={() =>
                      setDeleteConfirm({
                        type: "venue",
                        id: template.id,
                        name: template.name,
                      })
                    }
                    onPreview={() => setPreviewTemplate(template)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="organization" className="mt-6">
            {filteredOrgs.length === 0 ? (
              <EmptyState
                icon={<Users className="w-12 h-12" />}
                title="Ekip atama şablonu yok"
                description="Etkinlik ekip organizasyonunda şablon olarak kaydedebilirsiniz"
                actionLabel="Etkinliklere Git"
                actionHref="/events"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrgs.map((template) => (
                  <OrgTemplateCard
                    key={template.id}
                    template={template}
                    onDelete={() =>
                      setDeleteConfirm({
                        type: "org",
                        id: template.id,
                        name: template.name,
                      })
                    }
                    onPreview={() => {
                      // İlk venue template'den placedTables al
                      const firstVenue = venueTemplates[0];
                      if (firstVenue?.layoutData?.placedTables) {
                        setPlacedTablesForOrg(
                          firstVenue.layoutData.placedTables
                        );
                      }
                      if (firstVenue?.layoutData?.stageElements) {
                        setStageElementsForOrg(
                          firstVenue.layoutData.stageElements
                        );
                      }
                      setPreviewOrgTemplate(template);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Şablonu Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              &quot;{deleteConfirm?.name}&quot; şablonunu silmek istediğinize
              emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
              İptal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={
                deleteConfirm?.type === "venue"
                  ? handleDeleteVenue
                  : handleDeleteOrg
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!previewTemplate}
        onOpenChange={() => setPreviewTemplate(null)}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" />
              {previewTemplate?.name} - Yerleşim Önizleme
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Şablondaki masa yerleşiminin önizlemesi
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {previewTemplate && (
              <LayoutPreview layoutData={previewTemplate.layoutData} />
            )}
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <LayoutGrid className="w-4 h-4" />
                {previewTemplate?.layoutData?.placedTables?.length ||
                  previewTemplate?.layoutData?.tables?.length ||
                  0}{" "}
                masa
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {(
                  previewTemplate?.layoutData?.placedTables ||
                  previewTemplate?.layoutData?.tables ||
                  []
                ).reduce((sum: number, t: any) => sum + (t.capacity || 0), 0) ||
                  0}{" "}
                kişi
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setPreviewTemplate(null)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <X className="w-4 h-4 mr-2" />
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ekip Şablonu Detay Modal */}
      <Dialog
        open={!!previewOrgTemplate}
        onOpenChange={() => {
          setPreviewOrgTemplate(null);
          setPlacedTablesForOrg([]);
          setStageElementsForOrg([]);
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              {previewOrgTemplate?.name} - Ekip Organizasyonu
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Şablondaki ekip atamaları ve masa grupları
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {previewOrgTemplate && (
              <OrgLayoutPreview
                placedTables={placedTablesForOrg}
                tableGroups={previewOrgTemplate.tableGroups || []}
                stageElements={stageElementsForOrg}
                teams={teamsData}
              />
            )}
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {previewOrgTemplate?.staffAssignments?.length || 0} personel
              </span>
              <span className="flex items-center gap-1">
                <LayoutGrid className="w-4 h-4" />
                {previewOrgTemplate?.tableGroups?.length || 0} grup
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setPreviewOrgTemplate(null);
                setPlacedTablesForOrg([]);
                setStageElementsForOrg([]);
              }}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <X className="w-4 h-4 mr-2" />
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function LayoutPreview({ layoutData }: { layoutData: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // placedTables veya tables kullan
    const tables = layoutData.placedTables || layoutData.tables || [];
    const stageElements = layoutData.stageElements || [];

    if (tables.length === 0 && stageElements.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    [...tables, ...stageElements].forEach((item: any) => {
      const x = item.x || 0;
      const y = item.y || 0;
      const w = item.width || 40;
      const h = item.height || 40;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const padding = 40;
    const contentWidth = maxX - minX || 1;
    const contentHeight = maxY - minY || 1;
    const scaleX = (width - padding * 2) / contentWidth;
    const scaleY = (height - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const offsetX = (width - contentWidth * scale) / 2 - minX * scale;
    const offsetY = (height - contentHeight * scale) / 2 - minY * scale;

    // Sahne elemanlarını çiz
    stageElements.forEach((element: any) => {
      const x = (element.x || 0) * scale + offsetX;
      const y = (element.y || 0) * scale + offsetY;
      const w = (element.width || 100) * scale;
      const h = (element.height || 50) * scale;

      ctx.fillStyle = "#64748b40";
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = `bold ${Math.max(8, 10 * scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(element.label || element.type || "", x + w / 2, y + h / 2);
    });

    // Masaları çiz
    tables.forEach((table: any) => {
      const x = (table.x || 0) * scale + offsetX;
      const y = (table.y || 0) * scale + offsetY;
      const w = 30 * scale;
      const h = 30 * scale;
      const isLoca = table.isLoca || table.id?.includes("loca");
      const type = table.type || "standard";

      let fillColor = "#22c55e";
      if (isLoca) {
        fillColor = "#a855f7";
      } else if (type === "vip") {
        fillColor = "#f59e0b";
      } else if (type === "premium") {
        fillColor = "#3b82f6";
      }

      ctx.fillStyle = fillColor + "60";
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 1.5;

      if (isLoca) {
        ctx.beginPath();
        ctx.roundRect(x, y, w * 1.2, h * 0.8, 3);
        ctx.fill();
        ctx.stroke();
      } else {
        const radius = Math.min(w, h) / 2;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(7, 9 * scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let displayLabel = "";
      if (isLoca && table.locaName) {
        displayLabel = table.locaName;
      } else if (table.tableNumber) {
        displayLabel = String(table.tableNumber);
      }

      if (isLoca) {
        ctx.fillText(displayLabel, x + (w * 1.2) / 2, y + (h * 0.8) / 2);
      } else {
        ctx.fillText(displayLabel, x + w / 2, y + h / 2);
      }
    });

    const legendY = height - 25;
    const legendItems = [
      { color: "#22c55e", label: "Standard" },
      { color: "#3b82f6", label: "Premium" },
      { color: "#f59e0b", label: "VIP" },
      { color: "#a855f7", label: "Loca" },
    ];

    ctx.font = "11px sans-serif";
    let legendX = 15;
    legendItems.forEach((item) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, legendX + 12, legendY);
      legendX += ctx.measureText(item.label).width + 30;
    });
  }, [layoutData]);

  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="w-full h-auto rounded border border-slate-700"
      />
    </div>
  );
}

function OrgLayoutPreview({
  placedTables,
  tableGroups,
  stageElements = [],
  teams = [],
}: {
  placedTables: PlacedTable[];
  tableGroups: any[];
  stageElements?: any[];
  teams?: any[];
}) {
  if (placedTables.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center">
        <MapPin className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <p className="text-slate-400">Yerleşim verisi bulunamadı</p>
      </div>
    );
  }

  // Bounding box hesapla - orijinal koordinatlar
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  placedTables.forEach((table) => {
    minX = Math.min(minX, table.x || 0);
    minY = Math.min(minY, table.y || 0);
    maxX = Math.max(maxX, (table.x || 0) + 40);
    maxY = Math.max(maxY, (table.y || 0) + 40);
  });

  stageElements.forEach((element: any) => {
    minX = Math.min(minX, element.x || 0);
    minY = Math.min(minY, element.y || 0);
    maxX = Math.max(maxX, (element.x || 0) + (element.width || 100));
    maxY = Math.max(maxY, (element.y || 0) + (element.height || 50));
  });

  // Orijinal içerik boyutları
  const contentWidth = maxX - minX || 1;
  const contentHeight = maxY - minY || 1;

  // Scale hesapla - daha küçük scale ile tüm içerik görünsün
  // Modal genişliği ~850px, yükseklik ~450px (lejant için yer bırak)
  const scale = Math.min(400 / contentWidth, 600 / contentHeight);
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;

  // Masa -> Ekip eşleştirmesi
  const getTableTeam = (tableId: string) => {
    const group = tableGroups.find((g: any) => g.tableIds?.includes(tableId));
    if (!group?.assignedTeamId) return null;
    return teams.find((t: any) => t.id === group.assignedTeamId);
  };

  // Aktif ekipleri bul
  const activeTeams = teams.filter((t: any) =>
    tableGroups.some((g: any) => g.assignedTeamId === t.id)
  );

  return (
    <div
      className="relative bg-slate-900 rounded-lg overflow-hidden"
      style={{ height: "520px" }}
    >
      <div
        className="absolute left-1/2 top-1/2 border border-slate-600 rounded"
        style={{
          width: scaledWidth,
          height: scaledHeight,
          transform: "translate(-50%, -85%)",
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        }}
      >
        {/* Sahne elemanları */}
        {stageElements.map((stage: any) => (
          <div
            key={stage.id}
            className="absolute flex items-center justify-center text-xs font-medium"
            style={{
              left: (stage.x - minX) * scale,
              top: (stage.y - minY) * scale,
              width: stage.width * scale,
              height: stage.height * scale,
              backgroundColor:
                stage.type === "system_control" ? "#dc2626" : "#3b82f6",
              opacity: 0.8,
              borderRadius: "4px",
            }}
          >
            <span className="text-white text-[10px]">{stage.label}</span>
          </div>
        ))}

        {/* Masalar - Ekip renkleriyle */}
        {placedTables.map((table) => {
          const team = getTableTeam(table.id);
          const isLoca = table.isLoca;
          const size = isLoca ? 16 : 20;

          return (
            <div
              key={table.id}
              className="absolute flex items-center justify-center"
              style={{
                left: (table.x - minX) * scale - size / 2,
                top: (table.y - minY) * scale - size / 2,
                width: size,
                height: isLoca ? 14 : size,
                backgroundColor: team?.color || "#475569",
                borderRadius: isLoca ? "3px" : "50%",
                border: team ? "2px solid rgba(255,255,255,0.3)" : "none",
              }}
            >
              <span className="text-white text-[8px] font-bold">
                {isLoca ? table.locaName : table.tableNumber}
              </span>
            </div>
          );
        })}
      </div>

      {/* Ekip Renk Açıklaması */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded-lg p-3">
        <p className="text-xs text-slate-400 mb-2">Ekipler</p>
        <div className="flex flex-wrap gap-2">
          {activeTeams.map((team: any) => (
            <div key={team.id} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-xs text-white">{team.name}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-500" />
            <span className="text-xs text-slate-400">Atanmamış</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VenueTemplateCard({
  template,
  onDelete,
  onPreview,
}: {
  template: VenueTemplate;
  onDelete: () => void;
  onPreview: () => void;
}) {
  // placedTables veya tables kullan
  const tables =
    template.layoutData?.placedTables || template.layoutData?.tables || [];
  const tableCount = tables.length;
  const totalCapacity = tables.reduce(
    (sum: number, t: any) => sum + (t.capacity || 0),
    0
  );

  return (
    <Card
      className="bg-slate-800/50 border-slate-700 hover:border-green-500/50 transition-all cursor-pointer group overflow-hidden"
      onClick={onPreview}
    >
      <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <MapPin className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-green-300 transition-colors">
                {template.name}
              </h3>
              {template.description && (
                <p className="text-xs text-slate-400 line-clamp-1">
                  {template.description}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-slate-800 border-slate-700"
            >
              <DropdownMenuItem className="text-slate-300 hover:text-white">
                <Copy className="w-4 h-4 mr-2" />
                Kopyala
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-700/50 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-green-400">{tableCount}</div>
            <div className="text-xs text-slate-400">Masa</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-blue-400">
              {totalCapacity}
            </div>
            <div className="text-xs text-slate-400">Kapasite</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={
              template.isPublic
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : "bg-slate-500/20 text-slate-400 border-slate-500/30"
            }
          >
            {template.isPublic ? "Marketplace" : "Özel"}
          </Badge>
          <span className="text-xs text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="w-3 h-3" />
            Önizlemek için tıkla
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function OrgTemplateCard({
  template,
  onDelete,
  onPreview,
}: {
  template: OrganizationTemplate;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const staffCount = template.staffAssignments?.length || 0;
  const groupCount = template.tableGroups?.length || 0;
  const teamCount = new Set(
    template.tableGroups?.map((g: any) => g.assignedTeamId).filter(Boolean)
  ).size;

  return (
    <Card
      className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer group overflow-hidden"
      onClick={onPreview}
    >
      <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-amber-300 transition-colors">
                {template.name}
              </h3>
              {template.description && (
                <p className="text-xs text-slate-400 line-clamp-1">
                  {template.description}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
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
                  onDelete();
                }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-700/50 rounded-lg px-2 py-2 text-center">
            <div className="text-lg font-bold text-amber-400">{staffCount}</div>
            <div className="text-xs text-slate-400">Personel</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg px-2 py-2 text-center">
            <div className="text-lg font-bold text-blue-400">{groupCount}</div>
            <div className="text-xs text-slate-400">Grup</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg px-2 py-2 text-center">
            <div className="text-lg font-bold text-green-400">{teamCount}</div>
            <div className="text-xs text-slate-400">Ekip</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {template.isDefault ? (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              Varsayılan
            </Badge>
          ) : (
            <div className="flex flex-wrap gap-1">
              {template.tags?.slice(0, 2).map((tag, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs bg-slate-700/50 border-slate-600 text-slate-300"
                >
                  {tag}
                </Badge>
              ))}
              {(!template.tags || template.tags.length === 0) && (
                <span className="text-xs text-slate-500">Etiket yok</span>
              )}
            </div>
          )}
          <span className="text-xs text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="w-3 h-3" />
            Detaylar için tıkla
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-600 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 mb-6 max-w-md">{description}</p>
      <Button asChild className="bg-blue-600 hover:bg-blue-700">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function TemplatesSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2 bg-slate-700" />
            <Skeleton className="h-4 w-64 bg-slate-700" />
          </div>
          <Skeleton className="h-10 w-64 bg-slate-700" />
        </div>
        <Skeleton className="h-10 w-96 bg-slate-700" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 bg-slate-700 rounded-xl" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
