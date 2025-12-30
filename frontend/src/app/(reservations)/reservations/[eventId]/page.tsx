"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  MapPin,
  UserCheck,
  Download,
  Mail,
  Ticket,
  Timer,
  Percent,
  UserPlus,
  RefreshCw,
  X,
  Phone,
  LayoutGrid,
  Box,
} from "lucide-react";
import { eventsApi, reservationsApi } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import type { Event, Reservation, ReservationStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvitationActionsModal } from "@/components/invitations/InvitationActionsModal";
import { PageContainer } from "@/components/ui/PageContainer";

// Canvas bileşenini client-side only olarak yükle
const ReservationViewCanvas = dynamic(
  () =>
    import("@/components/reservations/ReservationViewCanvas").then(
      (mod) => mod.ReservationViewCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-800 rounded-lg animate-pulse" />
    ),
  }
);

const statusLabels: Record<
  ReservationStatus,
  { label: string; color: string; bg: string }
> = {
  confirmed: {
    label: "Onaylandı",
    color: "text-green-400",
    bg: "bg-green-600/20",
  },
  pending: {
    label: "Beklemede",
    color: "text-yellow-400",
    bg: "bg-yellow-600/20",
  },
  cancelled: { label: "İptal", color: "text-red-400", bg: "bg-red-600/20" },
  checked_in: {
    label: "Giriş Yapıldı",
    color: "text-blue-400",
    bg: "bg-blue-600/20",
  },
  no_show: { label: "Gelmedi", color: "text-slate-400", bg: "bg-slate-600/20" },
};

// Geri Sayım Component
const CountdownDisplay = memo(function CountdownDisplay({
  eventDate,
}: {
  eventDate: string;
}) {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const eventTime = new Date(eventDate).getTime();
      const diff = eventTime - now;

      if (diff <= 0) {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isExpired: false,
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [eventDate]);

  if (countdown.isExpired) {
    return (
      <span className="text-yellow-400 font-medium">Etkinlik başladı!</span>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="font-bold text-purple-400">
        {String(countdown.days).padStart(2, "0")}
      </span>
      <span className="text-slate-500">g</span>
      <span className="font-bold text-purple-400">
        {String(countdown.hours).padStart(2, "0")}
      </span>
      <span className="text-slate-500">:</span>
      <span className="font-bold text-purple-400">
        {String(countdown.minutes).padStart(2, "0")}
      </span>
      <span className="text-slate-500">:</span>
      <span className="font-bold text-purple-400">
        {String(countdown.seconds).padStart(2, "0")}
      </span>
    </div>
  );
});

export default function EventReservationsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">(
    "all"
  );
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [invitationReservation, setInvitationReservation] =
    useState<Reservation | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<"2d" | "3d">("2d");

  // Veri yükleme
  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventRes, reservationsRes] = await Promise.all([
          eventsApi.getOne(eventId),
          reservationsApi.getAll({ eventId }),
        ]);
        setEvent(eventRes.data);
        setReservations(reservationsRes.data || []);
      } catch (error) {
        console.error("Veri yüklenemedi:", error);
        router.push("/reservations");
      } finally {
        setLoading(false);
      }
    };

    if (eventId) loadData();
  }, [eventId, router]);

  // Rezerveli masa ID'leri
  const reservedTableIds = useMemo(() => {
    return reservations
      .filter((r) => r.status !== "cancelled" && r.status !== "no_show")
      .map((r) => r.tableId);
  }, [reservations]);

  // Filtrelenmiş rezervasyonlar
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (r.customer?.fullName || r.guestName || "").toLowerCase();
        const phone = r.customer?.phone || r.guestPhone || "";
        if (!name.includes(query) && !phone.includes(query)) return false;
      }
      return true;
    });
  }, [reservations, statusFilter, searchQuery]);

  // İstatistikler
  const stats = useMemo(() => {
    const total = reservations.length;
    const confirmed = reservations.filter(
      (r) => r.status === "confirmed"
    ).length;
    const pending = reservations.filter((r) => r.status === "pending").length;
    const checkedIn = reservations.filter(
      (r) => r.status === "checked_in"
    ).length;
    const cancelled = reservations.filter(
      (r) => r.status === "cancelled"
    ).length;

    const tables =
      (event?.venueLayout as any)?.tables ||
      (event?.venueLayout as any)?.placedTables ||
      [];
    const tableCount = tables.length;
    const reservedTables = reservations.filter(
      (r) => r.status !== "cancelled" && r.status !== "no_show"
    ).length;
    const occupancyRate =
      tableCount > 0 ? Math.round((reservedTables / tableCount) * 100) : 0;

    return {
      total,
      confirmed,
      pending,
      checkedIn,
      cancelled,
      occupancyRate,
      tableCount,
      reservedTables,
    };
  }, [reservations, event]);

  // Yeni ve geri dönen misafir sayısı
  const guestStats = useMemo(() => {
    let newGuests = 0;
    let returningGuests = 0;
    reservations.forEach((r) => {
      if (r.status === "cancelled") return;
      if (
        r.customer?.totalAttendedEvents &&
        r.customer.totalAttendedEvents > 0
      ) {
        returningGuests++;
      } else {
        newGuests++;
      }
    });
    return { newGuests, returningGuests };
  }, [reservations]);

  // Masa tıklama - rezervasyon detayını göster
  const handleTableClick = (tableId: string) => {
    const reservation = reservations.find(
      (r) => r.tableId === tableId && r.status !== "cancelled"
    );
    if (reservation) {
      setSelectedReservation(reservation);
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="full">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </PageContainer>
    );
  }

  if (!event) return null;

  const eventDate = new Date(event.eventDate);
  const now = new Date();
  const isPast = eventDate < now;

  return (
    <PageContainer maxWidth="full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/reservations"
            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{event.name}</h1>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(event.eventDate)}
              </span>
              {!isPast && <CountdownDisplay eventDate={event.eventDate} />}
            </div>
          </div>
        </div>
        <Link
          href={`/reservations/${eventId}/new`}
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Yeni Rezervasyon</span>
        </Link>
      </div>

      {/* Ana Layout: Sol Canvas, Sağ 3 Card */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sol Taraf - Canvas (2/3 genişlik) */}
        <div className="xl:col-span-2">
          <Card className="bg-slate-800 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-purple-400" />
                  Etkinlik Alanı
                </span>
                {/* 3D Toggle Button - Ortada */}
                <Button
                  size="sm"
                  variant={canvasViewMode === "3d" ? "secondary" : "outline"}
                  onClick={() =>
                    setCanvasViewMode(canvasViewMode === "2d" ? "3d" : "2d")
                  }
                  className={
                    canvasViewMode === "3d"
                      ? "bg-cyan-600 text-white hover:bg-cyan-700 px-4"
                      : "border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 px-4"
                  }
                >
                  <Box className="w-4 h-4 mr-1.5" />
                  {canvasViewMode === "2d" ? "3D Görünüm" : "2D Görünüm"}
                </Button>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border-2 border-green-500 bg-green-500/20" />
                    <span className="text-slate-400">Boş</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-slate-400">Dolu</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-slate-400">Beklemede</span>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="h-[450px] sm:h-[500px] lg:h-[550px] xl:h-[600px]">
                <ReservationViewCanvas
                  event={event}
                  reservations={reservations}
                  onTableClick={handleTableClick}
                  viewMode={canvasViewMode}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Taraf - 3 Card Alt Alta */}
        <div className="space-y-4">
          {/* Card 1: İstatistikler */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-400" />
                İstatistikler
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Doluluk */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-400">Doluluk</span>
                  <span className="font-bold text-emerald-400">
                    %{stats.occupancyRate}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${stats.occupancyRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {stats.reservedTables} / {stats.tableCount} masa
                </p>
              </div>

              {/* Durum Dağılımı */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-400">
                    {stats.confirmed}
                  </p>
                  <p className="text-xs text-slate-400">Onaylı</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">
                    {stats.pending}
                  </p>
                  <p className="text-xs text-slate-400">Beklemede</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-400">
                    {stats.checkedIn}
                  </p>
                  <p className="text-xs text-slate-400">Giriş</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-red-400">
                    {stats.cancelled}
                  </p>
                  <p className="text-xs text-slate-400">İptal</p>
                </div>
              </div>

              {/* Misafir Tipleri */}
              <div className="flex gap-3">
                <div className="flex-1 bg-cyan-600/10 border border-cyan-600/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-cyan-400">
                    {guestStats.newGuests}
                  </p>
                  <p className="text-xs text-slate-400">Yeni</p>
                </div>
                <div className="flex-1 bg-purple-600/10 border border-purple-600/30 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-purple-400">
                    {guestStats.returningGuests}
                  </p>
                  <p className="text-xs text-slate-400">Geri Dönen</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Arama ve Filtre */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                Ara & Filtrele
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="İsim veya telefon..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "all",
                    "confirmed",
                    "pending",
                    "checked_in",
                    "cancelled",
                  ] as const
                ).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? "bg-purple-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {status === "all" ? "Tümü" : statusLabels[status]?.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Rezervasyon Listesi */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-pink-400" />
                  Rezervasyonlar
                </span>
                <Badge variant="secondary" className="text-xs">
                  {filteredReservations.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="max-h-[280px] sm:max-h-[320px] overflow-y-auto space-y-2">
                {filteredReservations.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Rezervasyon bulunamadı</p>
                  </div>
                ) : (
                  filteredReservations.map((reservation) => {
                    const tables =
                      (event?.venueLayout as any)?.tables ||
                      (event?.venueLayout as any)?.placedTables ||
                      [];
                    const table = tables.find(
                      (t: any) => t.id === reservation.tableId
                    );
                    let tableLabel = "Masa";
                    if (table?.label) {
                      tableLabel = table.label;
                    } else if (table?.tableNumber) {
                      tableLabel = `Masa ${table.tableNumber}`;
                    } else {
                      const idParts = reservation.tableId.split("-");
                      tableLabel = `Masa ${idParts[idParts.length - 1]}`;
                    }

                    return (
                      <div
                        key={reservation.id}
                        onClick={() => setSelectedReservation(reservation)}
                        className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              reservation.status === "confirmed"
                                ? "bg-green-500"
                                : reservation.status === "pending"
                                ? "bg-yellow-500"
                                : reservation.status === "checked_in"
                                ? "bg-blue-500"
                                : reservation.status === "cancelled"
                                ? "bg-red-500"
                                : "bg-slate-500"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {reservation.customer?.fullName ||
                                reservation.guestName ||
                                "Misafir"}
                            </p>
                            <p className="text-xs text-slate-400">
                              Masa {tableLabel} • {reservation.guestCount}k
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {reservation.status !== "cancelled" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvitationReservation(reservation);
                              }}
                              className="p-2 bg-pink-600/20 rounded-lg text-pink-400 hover:bg-pink-600/30 transition-colors"
                              title="E-Davetiye"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detay Modal */}
      <ReservationDetailModal
        reservation={selectedReservation}
        event={event}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />

      {/* E-Davetiye Modal */}
      <InvitationActionsModal
        reservation={invitationReservation}
        isOpen={!!invitationReservation}
        onClose={() => setInvitationReservation(null)}
      />
    </PageContainer>
  );
}

// Rezervasyon Detay Modal
function ReservationDetailModal({
  reservation,
  event,
  isOpen,
  onClose,
}: {
  reservation: Reservation | null;
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [qrLoading, setQrLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (reservation && isOpen && reservation.status !== "cancelled") {
      setQrLoading(true);
      reservationsApi
        .generateQRCode(reservation.id)
        .then((res) => setQrCodeUrl(res.data.qrCodeDataUrl))
        .catch(() => setQrCodeUrl(""))
        .finally(() => setQrLoading(false));
    }
  }, [reservation, isOpen]);

  if (!reservation) return null;

  const getTableLabel = (): string => {
    const tables =
      (event?.venueLayout as any)?.tables ||
      (event?.venueLayout as any)?.placedTables;
    if (tables) {
      const table = tables.find((t: any) => t.id === reservation.tableId);
      if (table) {
        // Label varsa kullan
        if (table.label) return table.label;
        // tableNumber varsa kullan
        if (table.tableNumber) return `Masa ${table.tableNumber}`;
        // ID'den çıkar
        const idParts = table.id.split("-");
        const lastPart = idParts[idParts.length - 1];
        return `Masa ${lastPart}`;
      }
    }
    // Fallback: ID'den çıkar
    const idParts = reservation.tableId.split("-");
    const lastPart = idParts[idParts.length - 1];
    return `Masa ${lastPart}`;
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `bilet-${reservation.id}.png`;
    link.click();
  };

  const handleCancel = async () => {
    if (!confirm("Bu rezervasyonu iptal etmek istediğinize emin misiniz?"))
      return;
    setCancelling(true);
    try {
      await reservationsApi.cancel(reservation.id);
      onClose();
      window.location.reload();
    } catch (err) {
      console.error("İptal hatası:", err);
      alert("Rezervasyon iptal edilemedi");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-purple-400" />
            Rezervasyon Detayı
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Durum */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Durum</span>
            <span
              className={`px-3 py-1 rounded-full text-xs ${
                statusLabels[reservation.status]?.bg
              } ${statusLabels[reservation.status]?.color}`}
            >
              {statusLabels[reservation.status]?.label}
            </span>
          </div>

          {/* Misafir Bilgileri */}
          <div className="bg-slate-700/50 rounded-lg p-3">
            <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-purple-400" />
              Misafir Bilgileri
            </h4>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-slate-400">Ad Soyad:</span>{" "}
                {reservation.customer?.fullName || reservation.guestName || "-"}
              </p>
              <p>
                <span className="text-slate-400">Telefon:</span>{" "}
                {reservation.customer?.phone || reservation.guestPhone
                  ? formatPhone(
                      reservation.customer?.phone ||
                        reservation.guestPhone ||
                        ""
                    )
                  : "-"}
              </p>
              <p>
                <span className="text-slate-400">E-posta:</span>{" "}
                {reservation.customer?.email || reservation.guestEmail || "-"}
              </p>
            </div>
          </div>

          {/* Rezervasyon Bilgileri */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <span className="text-slate-400 text-xs">Masa</span>
              <p className="font-bold text-lg">{getTableLabel()}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <span className="text-slate-400 text-xs">Kişi</span>
              <p className="font-bold text-lg">{reservation.guestCount}</p>
            </div>
          </div>

          {/* QR Kod */}
          {reservation.status !== "cancelled" && (
            <div className="flex flex-col items-center gap-2 pt-3 border-t border-slate-700">
              {qrLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : qrCodeUrl ? (
                <>
                  <div className="bg-white p-2 rounded-lg">
                    <img src={qrCodeUrl} alt="QR Kod" className="w-24 h-24" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadQR}
                    className="border-slate-600 text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" /> QR İndir
                  </Button>
                </>
              ) : null}
            </div>
          )}

          {/* Aksiyonlar */}
          {reservation.status !== "cancelled" &&
            reservation.status !== "checked_in" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full"
              >
                {cancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Rezervasyonu İptal Et
              </Button>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
