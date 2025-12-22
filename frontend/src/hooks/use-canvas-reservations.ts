/**
 * Canvas Rezervasyon Hook'u
 * Requirements: 8.1, 8.3, 8.4 - Canvas üzerinde rezervasyon gösterimi ve real-time güncellemeler
 */
import { useEffect, useCallback } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { useReservations } from "@/hooks/use-reservations";
import { socketService } from "@/lib/socket";
import type { Reservation } from "@/types";

interface UseCanvasReservationsOptions {
  eventId: string;
  enabled?: boolean;
}

/**
 * Canvas için rezervasyon verilerini yükler ve real-time güncellemeleri dinler
 */
export function useCanvasReservations({
  eventId,
  enabled = true,
}: UseCanvasReservationsOptions) {
  const { setReservations, handleCheckInUpdate, clearReservations } =
    useCanvasStore();

  // Rezervasyonları API'den çek
  const {
    data: reservations,
    isLoading,
    error,
    refetch,
  } = useReservations(enabled ? { eventId } : undefined);

  // Rezervasyonları store'a yükle
  useEffect(() => {
    if (reservations && enabled) {
      setReservations(reservations);
    }
  }, [reservations, enabled, setReservations]);

  // Socket.io real-time güncellemeleri dinle (Requirement 8.4)
  useEffect(() => {
    if (!enabled || !eventId) return;

    // Socket bağlantısı kur
    socketService.connect();
    socketService.joinEvent(eventId);

    // Check-in güncellemelerini dinle
    socketService.onTableCheckIn((data) => {
      handleCheckInUpdate(
        data.tableId,
        data.status as "checked_in" | "cancelled" | "no_show"
      );
    });

    // Rezervasyon güncellemelerini dinle
    socketService.onTableReservationUpdate(() => {
      // Tüm rezervasyonları yeniden çek
      refetch();
    });

    // Genel check-in event'ini de dinle
    socketService.onGuestCheckedIn((data) => {
      if (data.tableId) {
        handleCheckInUpdate(data.tableId, "checked_in");
      }
    });

    // Cleanup
    return () => {
      socketService.leaveEvent();
    };
  }, [eventId, enabled, handleCheckInUpdate, refetch]);

  // Component unmount olduğunda rezervasyonları temizle
  useEffect(() => {
    return () => {
      clearReservations();
    };
  }, [clearReservations]);

  // Manuel yenileme fonksiyonu
  const refreshReservations = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    reservations: reservations || [],
    isLoading,
    error,
    refreshReservations,
  };
}

/**
 * Belirli bir masa için rezervasyon bilgisini al
 */
export function useTableReservation(tableId: string): Reservation | null {
  const { reservations } = useCanvasStore();
  return (
    reservations.find(
      (r) =>
        r.tableId === tableId &&
        r.status !== "cancelled" &&
        r.status !== "no_show"
    ) || null
  );
}
