"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  Loader2,
  Calendar,
  Download,
  Mail,
  Ticket,
  X,
  Box,
  FileSpreadsheet,
} from "lucide-react";
import { eventsApi, reservationsApi } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import type { Event, Reservation, ReservationStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvitationActionsModal } from "@/components/invitations/InvitationActionsModal";
import { PageContainer } from "@/components/ui/PageContainer";
import { ReservationExcelImport } from "@/components/reservations/ReservationExcelImport";
import { NewReservationInlineForm } from "@/components/reservations/NewReservationInlineForm";

// Canvas bileşenini client-side only olarak yükle
const ReservationViewCanvas = dynamic(
  () =>
    import("@/components/reservations/ReservationViewCanvas").then(
      (mod) => mod.ReservationViewCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-800 rounded-lg animate-pulse" />
    ),
  },
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
    "all",
  );
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [invitationReservation, setInvitationReservation] =
    useState<Reservation | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<"2d" | "3d">("2d");
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [listContextMenu, setListContextMenu] = useState<{
    x: number;
    y: number;
    reservation: Reservation;
    tableLabel: string;
  } | null>(null);
  const [listCancelConfirm, setListCancelConfirm] = useState<{
    reservation: Reservation;
    tableLabel: string;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCancelConfirm, setBulkCancelConfirm] = useState(false);
  const [bulkCancelProgress, setBulkCancelProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [newReservationTableId, setNewReservationTableId] = useState<
    string | null
  >(null);

  // Veri yükleme — isInitial false ise (refresh) hata durumunda redirect yapma
  const loadData = async (isInitial = false) => {
    try {
      const [eventRes, reservationsRes] = await Promise.all([
        eventsApi.getOne(eventId),
        reservationsApi.getAll({ eventId }),
      ]);
      setEvent(eventRes.data);
      const resData = reservationsRes.data;
      setReservations(Array.isArray(resData) ? resData : (resData?.data ?? []));
    } catch (error) {
      console.error("Veri yüklenemedi:", error);
      if (isInitial) {
        router.push("/reservations");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) loadData(true);
  }, [eventId, router]);

  // Close list context menu on click anywhere
  useEffect(() => {
    if (!listContextMenu) return;
    const handler = () => setListContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [listContextMenu]);

  // Filtrelenmiş rezervasyonlar — "Tümü"de iptal edilenler gizli
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      // "Tümü" seçiliyken cancelled gizle, sadece "İptal" filtresiyle göster
      if (statusFilter === "all" && r.status === "cancelled") return false;
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

  // Masa tıklama - artık direkt modal açmıyor, canvas kartında detay gör butonu var
  const handleTableClick = (tableId: string) => {
    // Canvas kendi popup'ını gösteriyor, burada ek işlem yok
  };

  // Detay Gör butonu — canvas kartından tetiklenir
  const handleViewReservationDetail = (reservationId: string) => {
    const reservation = reservations.find((r) => r.id === reservationId);
    if (reservation) {
      setSelectedReservation(reservation);
    }
  };

  // Rezervasyon iptal — sayfa yenilenmeden state güncelle
  const handleCancelReservation = async (reservationId: string) => {
    try {
      await reservationsApi.cancel(reservationId);
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, status: "cancelled" as ReservationStatus }
            : r,
        ),
      );
      setSelectedReservation(null);
    } catch (err) {
      console.error("İptal hatası:", err);
    }
  };

  // Toplu iptal
  const handleBulkCancel = async () => {
    const ids = Array.from(selectedIds);
    setBulkCancelProgress({ current: 0, total: ids.length });

    try {
      // Sequential cancellation to avoid rate limiting
      for (let i = 0; i < ids.length; i++) {
        await reservationsApi.cancel(ids[i]);
        setBulkCancelProgress({ current: i + 1, total: ids.length });
        // Delay between requests to respect rate limits
        if (i < ids.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      setReservations((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id)
            ? { ...r, status: "cancelled" as ReservationStatus }
            : r,
        ),
      );
      setSelectedIds(new Set());
      setBulkCancelConfirm(false);
    } catch (err) {
      console.error("Toplu iptal hatası:", err);
    } finally {
      setBulkCancelProgress(null);
    }
  };

  // Seçim toggle
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Tümünü seç/kaldır (sadece iptal edilebilir olanlar)
  const selectableReservations = filteredReservations.filter(
    (r) => r.status !== "cancelled" && r.status !== "checked_in",
  );
  const allSelected =
    selectableReservations.length > 0 &&
    selectableReservations.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableReservations.map((r) => r.id)));
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
      {/* Tablet-Optimized Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/reservations"
            className="w-12 h-12 flex items-center justify-center bg-slate-800/80 rounded-xl hover:bg-slate-700/80 transition-colors flex-shrink-0 border border-slate-700/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-white truncate">
              {event.name}
            </h1>
            <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-400" />
                {formatDate(event.eventDate)}
              </span>
              {!isPast && <CountdownDisplay eventDate={event.eventDate} />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* 2D/3D Toggle - Tablet için daha büyük */}
          <div className="flex-1 sm:flex-none flex bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
            <button
              onClick={() => setCanvasViewMode("2d")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-medium transition-all ${canvasViewMode === "2d"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
            >
              <span className="text-lg">2D</span>
              <span className="hidden sm:inline">Harita</span>
            </button>
            <button
              onClick={() => setCanvasViewMode("3d")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-medium transition-all ${canvasViewMode === "3d"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
            >
              <Box className="w-4 h-4" />
              <span>3D</span>
            </button>
          </div>
          <button
            onClick={() => setShowExcelImport(true)}
            className="flex items-center justify-center gap-2 h-11 px-4 bg-emerald-600/80 hover:bg-emerald-500/80 rounded-xl text-sm font-medium transition-all border border-emerald-500/30"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="hidden sm:inline">Excel İçe Aktar</span>
          </button>
          <button
            onClick={() => setShowNewReservation(true)}
            className="flex items-center justify-center gap-2 h-11 px-5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 rounded-xl text-sm font-medium transition-all shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Yeni Rezervasyon</span>
            <span className="sm:hidden">Yeni</span>
          </button>
        </div>
      </div>

      {/* Ana Layout: Tablet-first — md'de 2 kolon, xl'de 3 kolon */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Sol Taraf - Canvas */}
        <div className="lg:col-span-5">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
            <div className="h-[55vh] md:h-[65vh] lg:h-[78vh] min-h-[450px]">
              <ReservationViewCanvas
                event={event}
                reservations={reservations}
                onTableClick={handleTableClick}
                onCancelReservation={handleCancelReservation}
                onViewReservationDetail={handleViewReservationDetail}
                viewMode={canvasViewMode}
                externalHighlightTableId={newReservationTableId}
              />
            </div>
          </div>
        </div>

        {/* Sağ Taraf — Tablet için geniş kartlar */}
        <div className="lg:col-span-2 space-y-4">
          {showNewReservation ? (
            /* Yeni Rezervasyon Inline Form */
            <NewReservationInlineForm
              event={event}
              reservations={reservations}
              onCancel={() => {
                setShowNewReservation(false);
                setNewReservationTableId(null);
              }}
              onSuccess={() => {
                setShowNewReservation(false);
                setNewReservationTableId(null);
                loadData();
              }}
              onTableSelect={setNewReservationTableId}
            />
          ) : (
            <>
              {/* Arama + Filtre — tablet için büyük */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="İsim veya telefon ile ara..."
                      className="w-full h-12 bg-slate-700/50 border border-slate-600/50 rounded-xl pl-12 pr-4 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
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
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === status
                          ? "bg-purple-600 text-white shadow-lg"
                          : "bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white"
                        }`}
                    >
                      {status === "all" ? "Tümü" : statusLabels[status]?.label}
                    </button>
                  ))}
                  </div>
                </div>

                {/* Rezervasyon Listesi — tablet için büyük kartlar */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                    <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      {selectableReservations.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 cursor-pointer"
                        />
                      )}
                      <Users className="w-4 h-4 text-pink-400" />
                      Rezervasyonlar
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedIds.size > 0 && (
                        <button
                          onClick={() => setBulkCancelConfirm(true)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors"
                        >
                          <X className="w-3 h-3" />
                          {selectedIds.size} İptal Et
                        </button>
                      )}
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-sm px-3">
                        {filteredReservations.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="max-h-[300px] lg:max-h-[400px] overflow-y-auto p-3 space-y-2">
                    {filteredReservations.length === 0 ? (
                      <div className="text-center py-10 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Rezervasyon bulunamadı</p>
                      </div>
                    ) : (
                      filteredReservations.map((reservation) => {
                      const allTables =
                        (event?.venueLayout as any)?.tables ||
                        (event?.venueLayout as any)?.placedTables ||
                        [];
                      const table = allTables.find(
                        (t: any) => t.id === reservation.tableId,
                      );
                      let tableLabel = "Masa";
                      if (table?.label) tableLabel = table.label;
                      else if (table?.tableNumber)
                        tableLabel = `Masa ${table.tableNumber}`;
                      else {
                        const idParts = reservation.tableId.split("-");
                        tableLabel = `Masa ${idParts[idParts.length - 1]}`;
                      }

                      return (
                        <div
                          key={reservation.id}
                          onClick={() => setSelectedReservation(reservation)}
                          onContextMenu={(e) => {
                            if (
                              reservation.status !== "cancelled" &&
                              reservation.status !== "checked_in"
                            ) {
                              e.preventDefault();
                              setListContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                reservation,
                                tableLabel,
                              });
                            }
                          }}
                          className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl hover:bg-slate-700/60 cursor-pointer transition-all group border border-transparent hover:border-slate-600/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {reservation.status !== "cancelled" &&
                              reservation.status !== "checked_in" && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(reservation.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelect(reservation.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 cursor-pointer flex-shrink-0"
                                />
                              )}
                            <div
                              className={`w-3 h-3 rounded-full flex-shrink-0 ${reservation.status === "confirmed"
                                ? "bg-green-500 shadow-green-500/50 shadow-lg"
                                : reservation.status === "pending"
                                  ? "bg-yellow-500 shadow-yellow-500/50 shadow-lg"
                                  : reservation.status === "checked_in"
                                      ? "bg-blue-500 shadow-blue-500/50 shadow-lg"
                                      : reservation.status === "cancelled"
                                        ? "bg-red-500"
                                        : "bg-slate-500"
                                }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {reservation.customer?.fullName ||
                                  reservation.guestName ||
                                  "Misafir"}
                              </p>
                              <p className="text-xs text-slate-500 flex items-center gap-2">
                                <span>{tableLabel}</span>
                                <span>•</span>
                                <span>{reservation.guestCount} kişi</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-1 rounded-lg ${reservation.status === "confirmed"
                                  ? "bg-green-500/20 text-green-300"
                                  : reservation.status === "pending"
                                    ? "bg-yellow-500/20 text-yellow-300"
                                    : reservation.status === "checked_in"
                                      ? "bg-blue-500/20 text-blue-300"
                                      : "bg-red-500/20 text-red-300"
                                }`}
                            >
                              {statusLabels[reservation.status]?.label}
                            </span>
                            {reservation.status !== "cancelled" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvitationReservation(reservation);
                                }}
                                className="w-9 h-9 flex items-center justify-center bg-pink-500/15 rounded-lg text-pink-400 hover:bg-pink-500/30 transition-colors opacity-0 group-hover:opacity-100"
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detay Modal */}
      <ReservationDetailModal
        reservation={selectedReservation}
        event={event}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        onCancel={handleCancelReservation}
      />

      {/* E-Davetiye Modal */}
      <InvitationActionsModal
        reservation={invitationReservation}
        isOpen={!!invitationReservation}
        onClose={() => setInvitationReservation(null)}
      />

      {/* Liste Sağ Tık Context Menu */}
      {listContextMenu && (
        <div
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{ left: listContextMenu.x, top: listContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-xs text-slate-400 truncate">
              {listContextMenu.reservation.customer?.fullName ||
                listContextMenu.reservation.guestName ||
                "Misafir"}
            </p>
            <p className="text-[10px] text-slate-500">
              {listContextMenu.tableLabel} •{" "}
              {listContextMenu.reservation.guestCount} kişi
            </p>
          </div>
          <button
            onClick={() => {
              setListCancelConfirm({
                reservation: listContextMenu.reservation,
                tableLabel: listContextMenu.tableLabel,
              });
              setListContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <X className="w-4 h-4" />
            Rezervasyonu İptal Et
          </button>
        </div>
      )}

      {/* Liste İptal Onay Modal */}
      {listCancelConfirm && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setListCancelConfirm(null)}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <X className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  Rezervasyonu İptal Et
                </h3>
                <p className="text-xs text-slate-400">Bu işlem geri alınamaz</p>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3 mb-4 space-y-1">
              <p className="text-sm text-white font-medium">
                {listCancelConfirm.reservation.customer?.fullName ||
                  listCancelConfirm.reservation.guestName ||
                  "Misafir"}
              </p>
              <p className="text-xs text-slate-400">
                {listCancelConfirm.tableLabel} •{" "}
                {listCancelConfirm.reservation.guestCount} kişi
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setListCancelConfirm(null)}
                className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  handleCancelReservation(listCancelConfirm.reservation.id);
                  setListCancelConfirm(null);
                }}
                className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toplu İptal Onay Modal */}
      {bulkCancelConfirm && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setBulkCancelConfirm(false)}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <X className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Toplu İptal</h3>
                <p className="text-xs text-slate-400">Bu işlem geri alınamaz</p>
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3 mb-4">
              <p className="text-sm text-white font-medium mb-2">
                {selectedIds.size} rezervasyon iptal edilecek:
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {reservations
                  .filter((r) => selectedIds.has(r.id))
                  .map((r) => (
                    <p key={r.id} className="text-xs text-slate-400">
                      • {r.customer?.fullName || r.guestName || "Misafir"} (
                      {r.guestCount} kişi)
                    </p>
                  ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkCancelConfirm(false)}
                className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={handleBulkCancel}
                className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {selectedIds.size} İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel İçe Aktarma Dialog */}
      <ReservationExcelImport
        eventId={eventId}
        isOpen={showExcelImport}
        onClose={() => setShowExcelImport(false)}
        onImportComplete={loadData}
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
  onCancel,
}: {
  reservation: Reservation | null;
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
    onCancel: (id: string) => void;
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
      onCancel(reservation.id);
      onClose();
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
                    "",
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
