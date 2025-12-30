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
  UserCheck,
  Layers,
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

// Yerleşim Şablonu
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

// Ekip Organizasyonu Şablonu (Step 3'ten kaydedilen)
// Her şablon = Birden fazla takım + personel içerir
interface OrganizationTemplate {
  id: string;
  name: string; // "Şablon 1", "Şablon 2" gibi
  description?: string;
  teams: TeamInTemplate[]; // İçindeki takımlar
  totalPersonnel: number;
  createdAt?: string;
  updatedAt?: string;
}

// Şablon içindeki takım
interface TeamInTemplate {
  id: string;
  name: string;
  color: string;
  members: Array<{
    id: string;
    fullName: string;
    position?: string;
    avatar?: string;
  }>;
  leader?: {
    id: string;
    fullName: string;
    position?: string;
    avatar?: string;
  };
  leaderId?: string;
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
  const [previewVenue, setPreviewVenue] = useState<VenueTemplate | null>(null);
  const [previewOrg, setPreviewOrg] = useState<OrganizationTemplate | null>(
    null
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [venuesRes, teamsRes] = await Promise.all([
          venuesApi.getAll().catch(() => ({ data: [] })),
          staffApi.getTeams().catch(() => ({ data: [] })),
        ]);

        // Yerleşim şablonları
        const venues = Array.isArray(venuesRes.data)
          ? venuesRes.data
          : venuesRes.data || [];
        setVenueTemplates(venues);

        // Takımları "Ekip Organizasyonu Şablonu" olarak grupla
        // Her takım grubu = 1 şablon (şimdilik tüm takımlar tek şablonda)
        const teams = Array.isArray(teamsRes.data)
          ? teamsRes.data
          : teamsRes.data || [];

        if (teams.length > 0) {
          // Tüm takımları tek bir şablon olarak grupla
          const totalPersonnel = teams.reduce(
            (sum: number, t: any) =>
              sum + (t.members?.length || t.memberIds?.length || 0),
            0
          );

          const defaultTemplate: OrganizationTemplate = {
            id: "default-org-template",
            name: "Varsayılan Ekip Şablonu",
            description: `${teams.length} takım, ${totalPersonnel} personel içerir`,
            teams: teams.map((t: any) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              members: t.members || [],
              leader: t.leader,
              leaderId: t.leaderId,
            })),
            totalPersonnel,
            createdAt: new Date().toISOString(),
          };

          setOrgTemplates([defaultTemplate]);
        } else {
          setOrgTemplates([]);
        }
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
    // Organizasyon şablonu silme - tüm takımları sil
    try {
      const template = orgTemplates.find((t) => t.id === deleteConfirm.id);
      if (template) {
        // Tüm takımları sil
        await Promise.all(
          template.teams.map((team) => staffApi.deleteTeam(team.id))
        );
      }
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-amber-400" />
              Şablonlar
            </h1>
            <p className="text-slate-400 mt-1">
              Yerleşim ve ekip organizasyonu şablonlarını yönetin
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

        {/* Tabs */}
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
              Ekip Organizasyonu Şablonları ({filteredOrgs.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Yerleşim Şablonları */}
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
                    onPreview={() => setPreviewVenue(template)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Ekip Organizasyonu Şablonları */}
          <TabsContent value="organization" className="mt-6">
            {filteredOrgs.length === 0 ? (
              <EmptyState
                icon={<Users className="w-12 h-12" />}
                title="Ekip organizasyonu şablonu yok"
                description="Etkinlik ekip organizasyonunda (Step 3) şablon olarak kaydedebilirsiniz"
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
                    onPreview={() => setPreviewOrg(template)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation */}
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
              {deleteConfirm?.type === "org" && (
                <span className="block mt-2 text-red-400">
                  ⚠️ Bu şablondaki tüm takımlar da silinecek!
                </span>
              )}
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

      {/* Venue Preview Modal */}
      <Dialog open={!!previewVenue} onOpenChange={() => setPreviewVenue(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" />
              {previewVenue?.name} - Yerleşim Önizleme
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Şablondaki masa yerleşiminin önizlemesi
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {previewVenue && (
              <LayoutPreview layoutData={previewVenue.layoutData} />
            )}
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <LayoutGrid className="w-4 h-4" />
                {previewVenue?.layoutData?.placedTables?.length ||
                  previewVenue?.layoutData?.tables?.length ||
                  0}{" "}
                masa
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setPreviewVenue(null)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <X className="w-4 h-4 mr-2" />
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Organization Template Preview Modal */}
      <Dialog open={!!previewOrg} onOpenChange={() => setPreviewOrg(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              {previewOrg?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {previewOrg?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Özet Bilgiler */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-400">
                  {previewOrg?.teams.length || 0}
                </div>
                <div className="text-xs text-slate-400">Takım</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {previewOrg?.totalPersonnel || 0}
                </div>
                <div className="text-xs text-slate-400">Personel</div>
              </div>
            </div>

            {/* Takımlar Listesi */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">Takımlar</h4>
              {previewOrg?.teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-slate-700/30 rounded-lg p-3 border-l-4"
                  style={{ borderLeftColor: team.color }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="font-medium text-white">
                        {team.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-slate-600/50 text-slate-300 border-slate-500"
                    >
                      {team.members?.length || 0} üye
                    </Badge>
                  </div>

                  {/* Lider */}
                  {team.leader && (
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <UserCheck className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-400">Lider:</span>
                      <span className="text-white">{team.leader.fullName}</span>
                    </div>
                  )}

                  {/* Üye Avatarları */}
                  <div className="flex -space-x-2">
                    {team.members?.slice(0, 6).map((member, idx) => (
                      <div
                        key={member.id}
                        className="w-7 h-7 rounded-full border-2 border-slate-700 overflow-hidden"
                        style={{ zIndex: 6 - idx }}
                        title={member.fullName}
                      >
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: team.color }}
                          >
                            {member.fullName.charAt(0)}
                          </div>
                        )}
                      </div>
                    ))}
                    {(team.members?.length || 0) > 6 && (
                      <div className="w-7 h-7 rounded-full border-2 border-slate-700 bg-slate-600 flex items-center justify-center text-xs text-white">
                        +{(team.members?.length || 0) - 6}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-4 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={() => setPreviewOrg(null)}
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

// ==================== COMPONENT: LayoutPreview ====================
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

    // Sahne elemanları
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

    // Masalar
    tables.forEach((table: any) => {
      const x = (table.x || 0) * scale + offsetX;
      const y = (table.y || 0) * scale + offsetY;
      const w = 30 * scale;
      const h = 30 * scale;
      const isLoca = table.isLoca || table.id?.includes("loca");
      const type = table.type || "standard";

      let fillColor = "#22c55e";
      if (isLoca) fillColor = "#a855f7";
      else if (type === "vip") fillColor = "#f59e0b";
      else if (type === "premium") fillColor = "#3b82f6";

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
      if (isLoca && table.locaName) displayLabel = table.locaName;
      else if (table.tableNumber) displayLabel = String(table.tableNumber);

      if (isLoca) {
        ctx.fillText(displayLabel, x + (w * 1.2) / 2, y + (h * 0.8) / 2);
      } else {
        ctx.fillText(displayLabel, x + w / 2, y + h / 2);
      }
    });

    // Legend
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

// ==================== COMPONENT: VenueTemplateCard ====================
function VenueTemplateCard({
  template,
  onDelete,
  onPreview,
}: {
  template: VenueTemplate;
  onDelete: () => void;
  onPreview: () => void;
}) {
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
            Önizle
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== COMPONENT: OrgTemplateCard ====================
function OrgTemplateCard({
  template,
  onDelete,
  onPreview,
}: {
  template: OrganizationTemplate;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const teamCount = template.teams?.length || 0;
  const personnelCount = template.totalPersonnel || 0;

  // İlk 4 takımın renklerini al
  const teamColors = template.teams?.slice(0, 4).map((t) => t.color) || [];

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
              <Layers className="w-5 h-5 text-amber-400" />
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

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-700/50 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-amber-400">{teamCount}</div>
            <div className="text-xs text-slate-400">Takım</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold text-blue-400">
              {personnelCount}
            </div>
            <div className="text-xs text-slate-400">Personel</div>
          </div>
        </div>

        {/* Takım Renkleri */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {teamColors.map((color, idx) => (
              <div
                key={idx}
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
            {teamCount > 4 && (
              <span className="text-xs text-slate-500 ml-1">
                +{teamCount - 4}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="w-3 h-3" />
            Detaylar
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== COMPONENT: EmptyState ====================
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

// ==================== COMPONENT: TemplatesSkeleton ====================
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
