"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Calendar,
  Clock,
  Edit,
  Trash2,
  XCircle,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Users,
  Timer,
} from "lucide-react";
import { eventsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer } from "@/components/ui/PageContainer";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast-notification";

// ==================== TYPES ====================
interface Event {
  id: string;
  name: string;
  eventDate: string;
  eventType?: string;
  status: string;
  totalCapacity: number;
  reservedCount?: number;
  hasVenueLayout?: boolean;
  hasTeamAssignment?: boolean;
}

interface EventForm {
  name: string;
  eventDate: string;
  eventTime: string;
  eventType: string;
}

type TabType = "planning" | "upcoming" | "completed";

// ==================== CONSTANTS ====================
const EVENT_TYPES = [
  {
    value: "concert",
    label: "Konser",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  {
    value: "standup",
    label: "Stand Up Show",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
  {
    value: "party",
    label: "Party",
    color: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  },
  {
    value: "conference",
    label: "Konferans",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    value: "other",
    label: "Diğer",
    color: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  },
];

// ==================== MAIN COMPONENT ====================
export default function EventsPage() {
  const router = useRouter();
  const toast = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("planning");

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New Event Modal
  const [newEventModalOpen, setNewEventModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState<EventForm>({
    name: "",
    eventDate: "",
    eventTime: "",
    eventType: "concert",
  });

  // Edit Event Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [editForm, setEditForm] = useState<EventForm>({
    name: "",
    eventDate: "",
    eventTime: "",
    eventType: "wedding",
  });
  const [updating, setUpdating] = useState(false);

  // ==================== DATA FETCHING ====================
  const fetchEvents = async () => {
    try {
      setError(null);
      const response = await eventsApi.getAll();
      setEvents(response.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Etkinlikler yüklenemedi");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // ==================== HANDLERS ====================
  const handleDelete = async () => {
    if (!eventToDelete) return;
    setDeleting(true);
    try {
      await eventsApi.delete(eventToDelete.id);
      toast.success("Etkinlik silindi");
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      fetchEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Silinemedi");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.name || !newEvent.eventDate || !newEvent.eventTime) {
      toast.error("Tüm alanları doldurun");
      return;
    }

    setSaving(true);
    try {
      const eventDateTime = `${newEvent.eventDate}T${newEvent.eventTime}:00`;
      const response = await eventsApi.create({
        name: newEvent.name,
        eventDate: eventDateTime,
        eventType: newEvent.eventType,
        status: "draft",
        totalCapacity: 100,
      });

      toast.success("Etkinlik oluşturuldu");
      setNewEventModalOpen(false);
      setNewEvent({
        name: "",
        eventDate: "",
        eventTime: "",
        eventType: "wedding",
      });
      fetchEvents();

      if (response.data?.id) {
        router.push(`/events/${response.data.id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Oluşturulamadı");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (event: Event) => {
    const date = new Date(event.eventDate);
    setEditEvent(event);
    setEditForm({
      name: event.name,
      eventDate: date.toISOString().split("T")[0],
      eventTime: date.toTimeString().slice(0, 5),
      eventType: event.eventType || "other",
    });
    setEditModalOpen(true);
  };

  const handleUpdateEvent = async () => {
    if (
      !editEvent ||
      !editForm.name ||
      !editForm.eventDate ||
      !editForm.eventTime
    ) {
      toast.error("Tüm alanları doldurun");
      return;
    }

    setUpdating(true);
    try {
      const eventDateTime = `${editForm.eventDate}T${editForm.eventTime}:00`;
      await eventsApi.update(editEvent.id, {
        name: editForm.name,
        eventDate: eventDateTime,
        eventType: editForm.eventType,
      });

      toast.success("Etkinlik güncellendi");
      setEditModalOpen(false);
      setEditEvent(null);
      fetchEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Güncellenemedi");
    } finally {
      setUpdating(false);
    }
  };

  // ==================== COMPUTED VALUES ====================
  const now = new Date();

  const planningEvents = events.filter((e) => {
    const eventDate = new Date(e.eventDate);
    const hasVenue = e.hasVenueLayout ?? false;
    const hasTeam = e.hasTeamAssignment ?? false;
    return eventDate >= now && (!hasVenue || !hasTeam);
  });

  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.eventDate);
    const hasVenue = e.hasVenueLayout ?? false;
    const hasTeam = e.hasTeamAssignment ?? false;
    return eventDate >= now && hasVenue && hasTeam;
  });

  const completedEvents = events.filter((e) => new Date(e.eventDate) < now);

  const getFilteredEvents = () => {
    switch (activeTab) {
      case "planning":
        return planningEvents;
      case "upcoming":
        return upcomingEvents;
      case "completed":
        return completedEvents;
    }
  };

  const filteredEvents = getFilteredEvents();

  // ==================== HELPERS ====================
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventType = (type?: string) => {
    return (
      EVENT_TYPES.find((t) => t.value === type) ||
      EVENT_TYPES[EVENT_TYPES.length - 1]
    );
  };

  const getCountdown = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const diff = eventDate.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days === 0) return `${hours} saat`;
    if (days === 1) return "Yarın";
    return `${days} gün`;
  };

  const tabConfig = {
    planning: {
      label: "Planlama Aşamasında",
      count: planningEvents.length,
      description:
        "Alan düzeni veya ekip organizasyonu tamamlanmamış etkinlikler",
      emptyText: "Planlama bekleyen etkinlik yok",
    },
    upcoming: {
      label: "Gelecek Etkinlikler",
      count: upcomingEvents.length,
      description: "Hazırlıkları tamamlanmış, rezervasyona açık etkinlikler",
      emptyText: "Hazır etkinlik yok",
    },
    completed: {
      label: "Tamamlanan",
      count: completedEvents.length,
      description: "Geçmiş tarihli tamamlanmış etkinlikler",
      emptyText: "Tamamlanan etkinlik yok",
    },
  };

  // ==================== RENDER ====================
  if (error) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-400 mb-2">Hata</h3>
            <p className="text-slate-400 mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-red-500/30 text-red-400"
            >
              Tekrar Dene
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full bg-slate-700" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full bg-slate-700" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Etkinliği Sil
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              <span className="font-semibold text-white">
                {eventToDelete?.name}
              </span>{" "}
              silinecek. Emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-700 border-slate-600"
              disabled={deleting}
            >
              İptal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Event Modal */}
      <Dialog open={newEventModalOpen} onOpenChange={setNewEventModalOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Calendar className="w-5 h-5 text-blue-400" />
              Yeni Etkinlik
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Yeni bir etkinlik oluşturmak için bilgileri doldurun.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Etkinlik Adı *</label>
              <Input
                placeholder="Örn: Yılbaşı Partisi"
                value={newEvent.name}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, name: e.target.value })
                }
                className="bg-slate-900 border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Tarih *</label>
                <Input
                  type="date"
                  value={newEvent.eventDate}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, eventDate: e.target.value })
                  }
                  className="bg-slate-900 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Saat *</label>
                <Input
                  type="time"
                  value={newEvent.eventTime}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, eventTime: e.target.value })
                  }
                  className="bg-slate-900 border-slate-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Etkinlik Türü *</label>
              <Select
                value={newEvent.eventType}
                onValueChange={(v) =>
                  setNewEvent({ ...newEvent, eventType: v })
                }
              >
                <SelectTrigger className="bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setNewEventModalOpen(false)}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Oluştur"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Edit className="w-5 h-5 text-blue-400" />
              Etkinliği Düzenle
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Etkinlik bilgilerini güncelleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Etkinlik Adı *</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="bg-slate-900 border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Tarih *</label>
                <Input
                  type="date"
                  value={editForm.eventDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, eventDate: e.target.value })
                  }
                  className="bg-slate-900 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Saat *</label>
                <Input
                  type="time"
                  value={editForm.eventTime}
                  onChange={(e) =>
                    setEditForm({ ...editForm, eventTime: e.target.value })
                  }
                  className="bg-slate-900 border-slate-700"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Etkinlik Türü *</label>
              <Select
                value={editForm.eventType}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, eventType: v })
                }
              >
                <SelectTrigger className="bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              className="border-slate-600"
            >
              İptal
            </Button>
            <Button
              onClick={handleUpdateEvent}
              disabled={updating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Kaydet"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
          {(Object.keys(tabConfig) as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? tab === "planning"
                    ? "bg-amber-600 text-white"
                    : tab === "upcoming"
                    ? "bg-green-600 text-white"
                    : "bg-slate-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              {tabConfig[tab].label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab ? "bg-white/20" : "bg-slate-700"
                }`}
              >
                {tabConfig[tab].count}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          {/* Table Top Bar - Buton Sol + Açıklama Orta */}
          <div className="relative flex items-center justify-center px-6 py-3 border-b border-slate-700/50">
            {activeTab === "planning" && (
              <Button
                onClick={() => setNewEventModalOpen(true)}
                className="absolute left-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium shadow-lg shadow-emerald-500/25 border-0"
              >
                <Plus className="w-5 h-5 mr-2" />
                Yeni Etkinlik
              </Button>
            )}
            <p className="text-sm text-slate-500">
              {tabConfig[activeTab].description}
            </p>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-700 text-sm font-medium text-slate-400">
            <div className="col-span-2">Tarih & Saat</div>
            <div className="col-span-3">Etkinlik</div>
            <div className="col-span-2 text-center">Tür</div>
            <div className="col-span-1 text-center">Alan</div>
            <div className="col-span-1 text-center">Ekip</div>
            {activeTab === "upcoming" && (
              <div className="col-span-2 text-center">Geri Sayım</div>
            )}
            {activeTab === "planning" && (
              <div className="col-span-3 text-center">İşlemler</div>
            )}
            {activeTab === "upcoming" && (
              <div className="col-span-1 text-center">İşlem</div>
            )}
            {activeTab === "completed" && <div className="col-span-3"></div>}
          </div>

          {/* Table Body */}
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">{tabConfig[activeTab].emptyText}</p>
              {activeTab !== "planning" && (
                <Button
                  onClick={() => setActiveTab("planning")}
                  variant="outline"
                  className="mt-4 border-slate-600"
                >
                  Planlama Aşamasına Git
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {filteredEvents.map((event) => {
                const hasVenue = event.hasVenueLayout ?? false;
                const hasTeam = event.hasTeamAssignment ?? false;
                const eventType = getEventType(event.eventType);

                return (
                  <div
                    key={event.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Tarih & Saat */}
                    <div className="col-span-2">
                      <div className="text-sm text-white font-medium">
                        {formatDate(event.eventDate)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(event.eventDate)}
                      </div>
                    </div>

                    {/* Etkinlik Adı */}
                    <div className="col-span-3">
                      <Link
                        href={`/events/${event.id}`}
                        className="font-medium text-white hover:text-blue-400 transition-colors"
                      >
                        {event.name}
                      </Link>
                    </div>

                    {/* Etkinlik Türü Badge */}
                    <div className="col-span-2 flex justify-center">
                      <Badge variant="outline" className={eventType.color}>
                        {eventType.label}
                      </Badge>
                    </div>

                    {/* Alan Düzeni */}
                    <div className="col-span-1 flex justify-center">
                      <Link href={`/events/${event.id}/venue`}>
                        {hasVenue ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 cursor-pointer gap-1.5 px-3 py-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Hazır
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 cursor-pointer gap-1.5 px-3 py-1">
                            <MapPin className="w-4 h-4" />
                            Düzenle
                          </Badge>
                        )}
                      </Link>
                    </div>

                    {/* Ekip */}
                    <div className="col-span-1 flex justify-center">
                      <Link href={`/events/${event.id}/team-organization`}>
                        {hasTeam ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 cursor-pointer gap-1.5 px-3 py-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Hazır
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 cursor-pointer gap-1.5 px-3 py-1">
                            <Users className="w-4 h-4" />
                            Ata
                          </Badge>
                        )}
                      </Link>
                    </div>

                    {/* Geri Sayım - Sadece Gelecek */}
                    {activeTab === "upcoming" && (
                      <div className="col-span-2 flex justify-center">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
                          <Timer className="w-3 h-3" />
                          {getCountdown(event.eventDate)}
                        </Badge>
                      </div>
                    )}

                    {/* İşlemler - Planlama */}
                    {activeTab === "planning" && (
                      <div className="col-span-3 flex justify-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-lg"
                          onClick={() => openEditModal(event)}
                        >
                          <Edit className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg"
                          onClick={() => {
                            setEventToDelete(event);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    )}

                    {/* İşlemler - Gelecek (düzenle + sil) */}
                    {activeTab === "upcoming" && (
                      <div className="col-span-1 flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-lg"
                          onClick={() => openEditModal(event)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg"
                          onClick={() => {
                            setEventToDelete(event);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Tamamlanan - boş */}
                    {activeTab === "completed" && (
                      <div className="col-span-3"></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
