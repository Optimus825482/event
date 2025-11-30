"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  ArrowLeft,
  Ticket,
  UserCheck,
  Download,
  X,
  Search,
  Filter,
  Mail,
  UserPlus,
  RefreshCw,
  Percent,
} from "lucide-react";
import {
  useReservations,
  useEventStats,
  useQRCode,
  useCancelReservation,
} from "@/hooks/use-reservations";
import { eventsApi } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import type { Event, Reservation, ReservationStatus } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PageContainer, StatsGrid } from "@/components/ui/PageContainer";
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

// Kalan gün hesaplama
function getDaysRemaining(eventDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const diff = event.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Geri sayım hook'u
function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isExpired: false,
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

// Geri sayım bileşeni
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);

  if (isExpired) {
    return (
      <div className="text-center text-yellow-400">
        <span className="text-sm">Etkinlik başladı!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      <div className="text-center">
        <div className="text-lg sm:text-2xl font-bold text-blue-400">
          {days}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-400">Gün</div>
      </div>
      <span className="text-slate-500 text-lg">:</span>
      <div className="text-center">
        <div className="text-lg sm:text-2xl font-bold text-blue-400">
          {String(hours).padStart(2, "0")}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-400">Saat</div>
      </div>
      <span className="text-slate-500 text-lg">:</span>
      <div className="text-center">
        <div className="text-lg sm:text-2xl font-bold text-blue-400">
          {String(minutes).padStart(2, "0")}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-400">Dk</div>
      </div>
      <span className="text-slate-500 text-lg">:</span>
      <div className="text-center">
        <div className="text-lg sm:text-2xl font-bold text-blue-400">
          {String(seconds).padStart(2, "0")}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-400">Sn</div>
      </div>
    </div>
  );
}

// Rezervasyon detay modal
function ReservationDetailModal({
  reservation,
  isOpen,
  onClose,
}: {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: qrData, isLoading: qrLoading } = useQRCode(
    reservation?.id || ""
  );
  const cancelMutation = useCancelReservation();

  if (!reservation) return null;

  const handleDownloadQR = () => {
    if (!qrData?.qrCodeDataUrl) return;
    const link = document.createElement("a");
    link.href = qrData.qrCodeDataUrl;
    link.download = `bilet-${reservation.id}.png`;
    link.click();
  };

  const handleCancel = async () => {
    if (confirm("Bu rezervasyonu iptal etmek istediğinize emin misiniz?")) {
      try {
        await cancelMutation.mutateAsync(reservation.id);
        onClose();
      } catch (err) {
        console.error("İptal hatası:", err);
      }
    }
  };

  const getTableLabel = (): string => {
    if (reservation.event?.venueLayout?.tables) {
      const table = reservation.event.venueLayout.tables.find(
        (t) => t.id === reservation.tableId
      );
      if (table?.label) return table.label;
    }
    return reservation.tableId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Ticket className="w-5 h-5" />
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
            <h4 className="font-medium mb-2">Misafir Bilgileri</h4>
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
            <div>
              <span className="text-slate-400">Masa</span>
              <p className="font-medium text-lg">{getTableLabel()}</p>
            </div>
            <div>
              <span className="text-slate-400">Kişi Sayısı</span>
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
              ) : qrData?.qrCodeDataUrl ? (
                <>
                  <div className="bg-white p-3 rounded-lg">
                    <img
                      src={qrData.qrCodeDataUrl}
                      alt="QR Kod"
                      className="w-32 h-32"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadQR}
                      className="border-slate-600"
                    >
                      <Download className="w-4 h-4 mr-1" /> İndir
                    </Button>
                  </div>
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
                  disabled={cancelMutation.isPending}
                  className="w-full"
                >
                  {cancelMutation.isPending ? (
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

export default function ReservationDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">(
    "all"
  );
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [invitationReservation, setInvitationReservation] =
    useState<Reservation | null>(null);

  // Etkinlik bilgisini yükle
  useEffect(() => {
    if (!eventId) {
      router.push("/reservations");
      return;
    }

    const loadEvent = async () => {
      try {
        const response = await eventsApi.getOne(eventId);
        setEvent(response.data);
      } catch (err) {
        console.error("Etkinlik yüklenemedi:", err);
        router.push("/reservations");
      } finally {
        setEventLoading(false);
      }
    };

    loadEvent();
  }, [eventId, router]);

  // Rezervasyonlar ve istatistikler
  const { data: reservations, isLoading: reservationsLoading } =
    useReservations(eventId ? { eventId } : undefined);
  const { data: stats } = useEventStats(eventId || "");

  // Filtrelenmiş rezervasyonlar
  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      // Status filtresi
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      // Arama filtresi
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = (r.customer?.fullName || r.guestName || "").toLowerCase();
        const phone = r.customer?.phone || r.guestPhone || "";
        if (!name.includes(query) && !phone.includes(query)) return false;
      }
      return true;
    });
  }, [reservations, statusFilter, searchQuery]);

  // Yeni ve geri dönen misafir sayısı hesapla
  const guestStats = useMemo(() => {
    if (!reservations) return { newGuests: 0, returningGuests: 0 };

    let newGuests = 0;
    let returningGuests = 0;

    reservations.forEach((r) => {
      if (r.status === "cancelled") return;
      // Customer varsa ve daha önce etkinliğe katılmışsa
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

  // Doluluk oranı hesapla
  const occupancyRate = useMemo(() => {
    if (!event?.venueLayout?.tables) return 0;
    const totalTables = event.venueLayout.tables.length;
    if (totalTables === 0) return 0;

    const reservedTables =
      reservations?.filter(
        (r) => r.status !== "cancelled" && r.status !== "no_show"
      ).length || 0;

    return Math.round((reservedTables / totalTables) * 100);
  }, [event, reservations]);

  // Etkinlik değiştir
  const handleChangeEvent = () => {
    localStorage.removeItem("selectedEventId");
    router.push("/reservations");
  };

  if (eventLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </PageContainer>
    );
  }

  if (!event) return null;

  const daysRemaining = getDaysRemaining(event.eventDate);
  const isToday = daysRemaining === 0;
  const isPast = daysRemaining < 0;

  return (
    <PageContainer>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={handleChangeEvent}
              className="p-2 bg-slate-800 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">
                {event.name}
              </h1>
              <p className="text-slate-400 flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{formatDate(event.eventDate)}</span>
              </p>
            </div>
          </div>
          <Link
            href={`/reservations/new?eventId=${eventId}`}
            className="flex items-center justify-center gap-2 bg-blue-600 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="sm:hidden">Yeni</span>
            <span className="hidden sm:inline">Yeni Rezervasyon</span>
          </Link>
        </div>

        {/* Geri Sayım ve Doluluk */}
        {!isPast && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Geri Sayım */}
            <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-4 border border-blue-700/50">
              <div className="flex items-center gap-2 text-slate-300 mb-3">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Kalan Süre</span>
              </div>
              <CountdownTimer targetDate={event.eventDate} />
            </div>

            {/* Doluluk Oranı */}
            <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 rounded-xl p-4 border border-emerald-700/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Percent className="w-4 h-4" />
                  <span className="text-sm font-medium">Doluluk Oranı</span>
                </div>
                <span className="text-2xl font-bold text-emerald-400">
                  %{occupancyRate}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${occupancyRate}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {reservations?.filter(
                  (r) => r.status !== "cancelled" && r.status !== "no_show"
                ).length || 0}{" "}
                / {event.venueLayout?.tables?.length || 0} masa dolu
              </p>
            </div>
          </div>
        )}

        {/* İstatistikler */}
        <StatsGrid columns={5}>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700">
            <div className="flex items-center gap-1 sm:gap-2 text-slate-400 mb-1">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Toplam</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold">
              {stats?.totalExpected || reservations?.length || 0}
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700">
            <div className="flex items-center gap-1 sm:gap-2 text-green-400 mb-1">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Onaylı</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-400">
              {reservations?.filter((r) => r.status === "confirmed").length ||
                0}
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700">
            <div className="flex items-center gap-1 sm:gap-2 text-blue-400 mb-1">
              <UserCheck className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Giriş</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-400">
              {stats?.checkedIn || 0}
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700">
            <div className="flex items-center gap-1 sm:gap-2 text-yellow-400 mb-1">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Bekleyen</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-yellow-400">
              {reservations?.filter((r) => r.status === "pending").length || 0}
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700">
            <div className="flex items-center gap-1 sm:gap-2 text-red-400 mb-1">
              <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">İptal</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-400">
              {stats?.cancelled || 0}
            </p>
          </div>
        </StatsGrid>

        {/* Yeni ve Geri Dönen Misafirler */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <UserPlus className="w-4 h-4" />
              <span className="text-sm">Yeni Misafir</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400">
              {guestStats.newGuests}
            </p>
            <p className="text-xs text-slate-500 mt-1">İlk kez katılıyor</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Geri Dönen</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {guestStats.returningGuests}
            </p>
            <p className="text-xs text-slate-500 mt-1">Daha önce katılmış</p>
          </div>
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 text-sm sm:text-base focus:outline-none focus:border-blue-500"
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
                  statusFilter === status ? "bg-blue-600" : "bg-slate-800"
                }`}
              >
                {status === "all" ? "Tümü" : statusLabels[status]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rezervasyon Listesi */}
        {reservationsLoading ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-slate-400">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm sm:text-base">Rezervasyon bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filteredReservations.map((reservation) => {
              const tableLabel =
                reservation.event?.venueLayout?.tables?.find(
                  (t) => t.id === reservation.tableId
                )?.label || reservation.tableId;

              return (
                <div
                  key={reservation.id}
                  className="w-full bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700"
                >
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
                            : "bg-blue-600/20"
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
                          {reservation.customer?.totalAttendedEvents &&
                            reservation.customer.totalAttendedEvents > 0 && (
                              <span className="hidden sm:inline text-[10px] bg-purple-600/20 text-purple-400 px-1.5 py-0.5 rounded">
                                {reservation.customer.totalAttendedEvents}x
                              </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 truncate">
                          {reservation.customer?.phone || reservation.guestPhone
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
                        <p className="font-medium text-sm">Masa {tableLabel}</p>
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
                          {statusLabels[reservation.status]?.label.slice(0, 3)}
                        </span>
                      </span>
                      {/* E-Davetiye Butonu */}
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detay Modal */}
      <ReservationDetailModal
        reservation={selectedReservation}
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
