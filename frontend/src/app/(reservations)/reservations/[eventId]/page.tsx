"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  QrCode,
} from "lucide-react";
import { eventsApi, reservationsApi } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import type { Event, Reservation, ReservationStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, StatsGrid } from "@/components/ui/PageContainer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvitationActionsModal } from "@/components/invitations/InvitationActionsModal";

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
      <div className="text-center text-yellow-400">
        <span className="text-sm font-medium">Etkinlik başladı!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="text-center">
        <span className="text-xl font-bold text-purple-400 tabular-nums">
          {String(countdown.days).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">GÜN</span>
      </div>
      <span className="text-purple-500 font-bold">:</span>
      <div className="text-center">
        <span className="text-xl font-bold text-purple-400 tabular-nums">
          {String(countdown.hours).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">SAAT</span>
      </div>
      <span className="text-purple-500 font-bold">:</span>
      <div className="text-center">
        <span className="text-xl font-bold text-purple-400 tabular-nums">
          {String(countdown.minutes).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">DK</span>
      </div>
      <span className="text-purple-500 font-bold">:</span>
      <div className="text-center">
        <span className="text-xl font-bold text-purple-400 tabular-nums">
          {String(countdown.seconds).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">SN</span>
      </div>
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

    const tableCount = event?.venueLayout?.tables?.length || 0;
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

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[50vh]">
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
    <PageContainer>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/reservations"
              className="p-2 bg-slate-800 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">
                {event.name}
              </h1>
              <p className="text-slate-400 flex items-center gap-2 text-xs sm:text-sm">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{formatDate(event.eventDate)}</span>
              </p>
            </div>
          </div>
          <Link
            href={`/reservations/${eventId}/new`}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Rezervasyon</span>
          </Link>
        </div>

        {/* Geri Sayım ve Doluluk */}
        {!isPast && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-300 mb-3">
                  <Timer className="w-4 h-4" />
                  <span className="text-sm font-medium">Kalan Süre</span>
                </div>
                <CountdownDisplay eventDate={event.eventDate} />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-emerald-700/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Percent className="w-4 h-4" />
                    <span className="text-sm font-medium">Doluluk Oranı</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-400">
                    %{stats.occupancyRate}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stats.occupancyRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {stats.reservedTables} / {stats.tableCount} masa dolu
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* İstatistikler */}
        <StatsGrid columns={5}>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2 text-slate-400 mb-1">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Toplam</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2 text-green-400 mb-1">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Onaylı</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-400">
                {stats.confirmed}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2 text-blue-400 mb-1">
                <UserCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Giriş</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-400">
                {stats.checkedIn}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2 text-yellow-400 mb-1">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">Bekleyen</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-yellow-400">
                {stats.pending}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1 sm:gap-2 text-red-400 mb-1">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">İptal</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-400">
                {stats.cancelled}
              </p>
            </CardContent>
          </Card>
        </StatsGrid>

        {/* Yeni ve Geri Dönen Misafirler */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-cyan-400 mb-2">
                <UserPlus className="w-4 h-4" />
                <span className="text-sm">Yeni Misafir</span>
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {guestStats.newGuests}
              </p>
              <p className="text-xs text-slate-500 mt-1">İlk kez katılıyor</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm">Geri Dönen</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {guestStats.returningGuests}
              </p>
              <p className="text-xs text-slate-500 mt-1">Daha önce katılmış</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtreler */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Misafir adı veya telefon ara..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 text-sm sm:text-base focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
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
                className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  statusFilter === status ? "bg-purple-600" : "bg-slate-800"
                }`}
              >
                {status === "all" ? "Tümü" : statusLabels[status]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rezervasyon Listesi */}
        {filteredReservations.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-slate-400">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm sm:text-base">Rezervasyon bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filteredReservations.map((reservation) => {
              const tableLabel =
                event?.venueLayout?.tables?.find(
                  (t: any) => t.id === reservation.tableId
                )?.label || reservation.tableId;

              return (
                <Card
                  key={reservation.id}
                  className="bg-slate-800 border-slate-700 hover:border-purple-500/50 transition-colors"
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedReservation(reservation)}
                        className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 text-left"
                      >
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            reservation.customer?.totalAttendedEvents &&
                            reservation.customer.totalAttendedEvents > 0
                              ? "bg-purple-600/20"
                              : "bg-cyan-600/20"
                          }`}
                        >
                          {reservation.customer?.totalAttendedEvents &&
                          reservation.customer.totalAttendedEvents > 0 ? (
                            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                          ) : (
                            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm sm:text-base truncate">
                              {reservation.customer?.fullName ||
                                reservation.guestName ||
                                "Misafir"}
                            </h3>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-400 truncate">
                            {reservation.customer?.phone ||
                            reservation.guestPhone
                              ? formatPhone(
                                  reservation.customer?.phone ||
                                    reservation.guestPhone ||
                                    ""
                                )
                              : "-"}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="font-medium text-sm">
                            Masa {tableLabel}
                          </p>
                          <p className="text-xs text-slate-400">
                            {reservation.guestCount} kişi
                          </p>
                        </div>
                        <div className="text-right sm:hidden">
                          <p className="font-medium text-xs">{tableLabel}</p>
                          <p className="text-xs text-slate-400">
                            {reservation.guestCount}
                          </p>
                        </div>
                        <span
                          className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs ${
                            statusLabels[reservation.status]?.bg
                          } ${statusLabels[reservation.status]?.color}`}
                        >
                          <span className="hidden sm:inline">
                            {statusLabels[reservation.status]?.label}
                          </span>
                          <span className="sm:hidden">
                            {statusLabels[reservation.status]?.label.slice(
                              0,
                              3
                            )}
                          </span>
                        </span>
                        {reservation.status !== "cancelled" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInvitationReservation(reservation);
                            }}
                            className="p-2 bg-pink-600/20 rounded-lg text-pink-400 transition-colors"
                            title="E-Davetiye"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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
    if (event?.venueLayout?.tables) {
      const table = event.venueLayout.tables.find(
        (t: any) => t.id === reservation.tableId
      );
      if (table?.label) return table.label;
    }
    return reservation.tableId;
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
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-purple-400" />
            Rezervasyon Detayı
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Durum */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Durum</span>
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                statusLabels[reservation.status]?.bg
              } ${statusLabels[reservation.status]?.color}`}
            >
              {statusLabels[reservation.status]?.label}
            </span>
          </div>

          {/* Misafir Bilgileri */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
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
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <span className="text-slate-400 text-xs">Masa</span>
              <p className="font-medium text-lg">{getTableLabel()}</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <span className="text-slate-400 text-xs">Kişi Sayısı</span>
              <p className="font-medium text-lg">
                {reservation.guestCount} kişi
              </p>
            </div>
          </div>

          {/* Özel İstekler */}
          {reservation.specialRequests && (
            <div>
              <span className="text-slate-400 text-sm">Özel İstekler</span>
              <p className="bg-slate-700/50 rounded p-2 mt-1 text-sm">
                {reservation.specialRequests}
              </p>
            </div>
          )}

          {/* QR Kod */}
          {reservation.status !== "cancelled" && (
            <div className="flex flex-col items-center gap-3 pt-4 border-t border-slate-700">
              {qrLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              ) : qrCodeUrl ? (
                <>
                  <div className="bg-white p-3 rounded-lg">
                    <img src={qrCodeUrl} alt="QR Kod" className="w-32 h-32" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadQR}
                    className="border-slate-600"
                  >
                    <Download className="w-4 h-4 mr-1" /> QR Kod İndir
                  </Button>
                </>
              ) : null}
            </div>
          )}

          {/* Aksiyonlar */}
          {reservation.status !== "cancelled" &&
            reservation.status !== "checked_in" && (
              <div className="pt-4 border-t border-slate-700">
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
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
