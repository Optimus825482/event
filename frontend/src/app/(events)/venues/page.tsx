"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  MapPin,
  Users,
  Download,
  Globe,
  Lock,
  Star,
  Edit2,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  Layout,
  Loader2,
} from "lucide-react";
import { venuesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface VenueTemplate {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  usageCount: number;
  capacity?: number;
  createdBy?: string;
  rating?: number;
  thumbnail?: string;
  createdAt?: string;
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<VenueTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "public" | "private">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<VenueTemplate | null>(
    null
  );

  useEffect(() => {
    const loadVenues = async () => {
      try {
        const response = await venuesApi.getAll();
        setVenues(response.data || []);
      } catch (error) {
        console.error("Mekan şablonları yüklenemedi:", error);
        // Mock data
        setVenues([
          {
            id: "1",
            name: "Çırağan Sarayı Balo Salonu",
            description: "Klasik düğün salonu düzeni, 50 yuvarlak masa",
            isPublic: true,
            usageCount: 156,
            capacity: 500,
            createdBy: "EventFlow Team",
            rating: 4.8,
          },
          {
            id: "2",
            name: "Zorlu PSM Ana Sahne",
            description: "Tiyatro düzeni konferans salonu",
            isPublic: true,
            usageCount: 89,
            capacity: 1200,
            createdBy: "EventFlow Team",
            rating: 4.6,
          },
          {
            id: "3",
            name: "Hilton Balo Salonu",
            description: "Gala düzeni, VIP ve standart masalar",
            isPublic: true,
            usageCount: 67,
            capacity: 400,
            createdBy: "EventFlow Team",
            rating: 4.5,
          },
          {
            id: "4",
            name: "Özel Düğün Salonu",
            description: "Kendi oluşturduğum düğün düzeni",
            isPublic: false,
            usageCount: 12,
            capacity: 300,
            createdBy: "Benim",
          },
          {
            id: "5",
            name: "Konferans Düzeni A",
            description: "U şeklinde konferans masası",
            isPublic: false,
            usageCount: 5,
            capacity: 50,
            createdBy: "Benim",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadVenues();
  }, []);

  const filteredVenues = venues.filter((v) => {
    const matchesSearch = v.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "public" && v.isPublic) ||
      (filter === "private" && !v.isPublic);
    return matchesSearch && matchesFilter;
  });

  const publicVenues = filteredVenues.filter((v) => v.isPublic);
  const privateVenues = filteredVenues.filter((v) => !v.isPublic);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await venuesApi.delete(deleteConfirm.id);
      setVenues((prev) => prev.filter((v) => v.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Silme hatası:", error);
    }
  };

  // Şablon Kartı
  const VenueCard = ({ venue }: { venue: VenueTemplate }) => (
    <Card className="bg-slate-800 border-slate-700 overflow-hidden group">
      {/* Önizleme */}
      <div className="h-40 bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center relative">
        <Layout className="w-16 h-16 text-slate-500" />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/20 backdrop-blur"
          >
            <Eye className="w-4 h-4 mr-1" />
            Önizle
          </Button>
        </div>
        {/* Badge */}
        <div className="absolute top-2 right-2">
          {venue.isPublic ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <Globe className="w-3 h-3 mr-1" />
              Public
            </Badge>
          ) : (
            <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
              <Lock className="w-3 h-3 mr-1" />
              Özel
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-white line-clamp-1">
            {venue.name}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-slate-800 border-slate-700"
            >
              <DropdownMenuItem className="cursor-pointer">
                <Eye className="w-4 h-4 mr-2" />
                Görüntüle
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setEditingVenue(venue)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Copy className="w-4 h-4 mr-2" />
                Kopyala
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem
                className="cursor-pointer text-red-400"
                onClick={() => setDeleteConfirm(venue)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm text-slate-400 line-clamp-2 mb-3">
          {venue.description}
        </p>

        <div className="flex items-center gap-3 text-sm text-slate-400 mb-3">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {venue.capacity}
          </span>
          <span className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            {venue.usageCount}
          </span>
          {venue.rating && venue.rating > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Star className="w-4 h-4 fill-current" />
              {venue.rating}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-700">
          <span className="text-xs text-slate-500">{venue.createdBy}</span>
          <Button size="sm" className="bg-blue-600">
            Kullan
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <Skeleton className="h-10 w-36 bg-slate-700" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-slate-800 border-slate-700">
              <Skeleton className="h-40 bg-slate-700" />
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2 bg-slate-700" />
                <Skeleton className="h-4 w-full mb-3 bg-slate-700" />
                <Skeleton className="h-4 w-1/2 bg-slate-700" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-green-400" />
            Alan Şablonları
          </h1>
          <p className="text-slate-400">Mekan yerleşim planlarını yönetin</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Şablon Oluştur
        </Button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Şablon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "public", "private"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className={
                filter === f ? "bg-blue-600" : "border-slate-600 bg-slate-800"
              }
            >
              {f === "all" ? "Tümü" : f === "public" ? "Marketplace" : "Özel"}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="all" className="data-[state=active]:bg-green-600">
            Tümü ({filteredVenues.length})
          </TabsTrigger>
          <TabsTrigger
            value="marketplace"
            className="data-[state=active]:bg-green-600"
          >
            <Globe className="w-4 h-4 mr-2" />
            Marketplace ({publicVenues.length})
          </TabsTrigger>
          <TabsTrigger
            value="my-templates"
            className="data-[state=active]:bg-green-600"
          >
            <Lock className="w-4 h-4 mr-2" />
            Şablonlarım ({privateVenues.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {filteredVenues.length === 0 ? (
            <EmptyState onCreateClick={() => setShowCreateModal(true)} />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVenues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marketplace" className="mt-6">
          {publicVenues.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-16 h-16 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">Marketplace'te şablon bulunamadı</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicVenues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-templates" className="mt-6">
          {privateVenues.length === 0 ? (
            <EmptyState
              onCreateClick={() => setShowCreateModal(true)}
              isPrivate
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {privateVenues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
              {/* Yeni Şablon Kartı */}
              <Card
                className="bg-slate-800/50 border-slate-700 border-dashed cursor-pointer min-h-[300px] flex items-center justify-center"
                onClick={() => setShowCreateModal(true)}
              >
                <div className="text-center">
                  <Plus className="w-12 h-12 mx-auto text-slate-500 mb-2" />
                  <p className="text-slate-400">Yeni Şablon Oluştur</p>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal */}
      <Dialog
        open={showCreateModal || !!editingVenue}
        onOpenChange={() => {
          setShowCreateModal(false);
          setEditingVenue(null);
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingVenue ? "Şablonu Düzenle" : "Yeni Şablon Oluştur"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingVenue
                ? "Şablon bilgilerini güncelleyin"
                : "Yeni bir alan şablonu oluşturun"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Şablon Adı *</Label>
              <Input
                placeholder="Örn: Düğün Salonu A"
                className="bg-slate-700 border-slate-600"
                defaultValue={editingVenue?.name}
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <textarea
                placeholder="Şablon hakkında kısa açıklama..."
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                defaultValue={editingVenue?.description}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kapasite</Label>
                <Input
                  type="number"
                  placeholder="300"
                  className="bg-slate-700 border-slate-600"
                  defaultValue={editingVenue?.capacity}
                />
              </div>
              <div className="space-y-2">
                <Label>Görünürlük</Label>
                <Select
                  defaultValue={editingVenue?.isPublic ? "public" : "private"}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="private">Özel (Sadece Ben)</SelectItem>
                    <SelectItem value="public">Public (Marketplace)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-700/50">
              <p className="text-sm text-blue-200">
                Şablon oluşturulduktan sonra yerleşim editöründe sahne, duvar ve
                sabit alanları düzenleyebilirsiniz.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingVenue(null);
              }}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button className="bg-green-600">
              {editingVenue ? "Güncelle" : "Oluştur ve Düzenle"}
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
            <DialogTitle>Şablonu Sil</DialogTitle>
            <DialogDescription className="text-slate-400">
              <strong>{deleteConfirm?.name}</strong> şablonunu silmek
              istediğinizden emin misiniz? Bu işlem geri alınamaz.
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

// Empty State Component
function EmptyState({
  onCreateClick,
  isPrivate,
}: {
  onCreateClick: () => void;
  isPrivate?: boolean;
}) {
  return (
    <div className="text-center py-12">
      <MapPin className="w-16 h-16 mx-auto text-slate-600 mb-4" />
      <h3 className="text-lg font-medium text-white mb-2">
        {isPrivate ? "Henüz şablon oluşturmadınız" : "Şablon bulunamadı"}
      </h3>
      <p className="text-slate-400 mb-4">
        {isPrivate
          ? "Kendi mekan şablonlarınızı oluşturup tekrar kullanabilirsiniz"
          : "Arama kriterlerinize uygun şablon bulunamadı"}
      </p>
      <Button onClick={onCreateClick} className="bg-green-600">
        <Plus className="w-4 h-4 mr-2" />
        İlk Şablonu Oluştur
      </Button>
    </div>
  );
}
