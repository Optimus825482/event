/**
 * Rezervasyon Hook'ları - TanStack Query ile API entegrasyonu
 * Requirements: 7.1, 7.2, 7.3, 7.4 - Arama ve filtreleme
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reservationsApi, eventsApi, customersApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type {
  Reservation,
  ReservationFilters,
  CreateReservationDto,
  UpdateReservationDto,
  EventStats,
  QRCodeResult,
  Event,
  Customer,
} from "@/types";

// Query Keys
export const reservationKeys = {
  all: ["reservations"] as const,
  lists: () => [...reservationKeys.all, "list"] as const,
  list: (filters: ReservationFilters) =>
    [...reservationKeys.lists(), filters] as const,
  details: () => [...reservationKeys.all, "detail"] as const,
  detail: (id: string) => [...reservationKeys.details(), id] as const,
  qrCode: (id: string) => [...reservationKeys.all, "qrcode", id] as const,
  eventStats: (eventId: string) =>
    [...reservationKeys.all, "stats", eventId] as const,
  customerHistory: (customerId: string) =>
    [...reservationKeys.all, "customer-history", customerId] as const,
  customerInfo: (customerId: string) =>
    [...reservationKeys.all, "customer-info", customerId] as const,
};

/**
 * Tüm rezervasyonları getir - Filtreleme destekli
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export function useReservations(filters?: ReservationFilters) {
  const { token } = useAuthStore();

  return useQuery({
    queryKey: reservationKeys.list(filters || {}),
    queryFn: async () => {
      const response = await reservationsApi.getAll(filters);
      return response.data as Reservation[];
    },
    enabled: !!token, // Token yoksa API çağrısı yapma
  });
}

/**
 * Tek rezervasyon detayı
 */
export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: async () => {
      const response = await reservationsApi.getOne(id);
      return response.data as Reservation;
    },
    enabled: !!id,
  });
}

/**
 * Rezervasyon oluştur
 * Requirements: 1.1, 1.2
 */
export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateReservationDto) => {
      const response = await reservationsApi.create(dto);
      return response.data as Reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
  });
}

/**
 * Rezervasyon güncelle
 */
export function useUpdateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: UpdateReservationDto;
    }) => {
      const response = await reservationsApi.update(id, dto);
      return response.data as Reservation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: reservationKeys.detail(data.id),
      });
    },
  });
}

/**
 * Rezervasyon iptal et
 */
export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await reservationsApi.cancel(id);
      return response.data as Reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
  });
}

/**
 * Rezervasyon sil
 */
export function useDeleteReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await reservationsApi.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.lists() });
    },
  });
}

/**
 * QR kod oluştur
 * Requirements: 3.1, 3.3
 */
export function useQRCode(reservationId: string) {
  return useQuery({
    queryKey: reservationKeys.qrCode(reservationId),
    queryFn: async () => {
      const response = await reservationsApi.generateQRCode(reservationId);
      return response.data as QRCodeResult;
    },
    enabled: !!reservationId,
    staleTime: Infinity, // QR kod değişmez, cache'le
  });
}

/**
 * Event istatistikleri
 * Requirement: 5.1
 */
export function useEventStats(eventId: string) {
  return useQuery({
    queryKey: reservationKeys.eventStats(eventId),
    queryFn: async () => {
      const response = await reservationsApi.getEventStats(eventId);
      return response.data as EventStats;
    },
    enabled: !!eventId,
    refetchInterval: 5000, // 5 saniyede bir güncelle
  });
}

/**
 * Misafir geçmişi
 * Requirement: 6.1
 */
export function useCustomerHistory(customerId: string) {
  return useQuery({
    queryKey: reservationKeys.customerHistory(customerId),
    queryFn: async () => {
      const response = await reservationsApi.getCustomerHistory(customerId);
      return response.data;
    },
    enabled: !!customerId,
  });
}

/**
 * Misafir bilgileri (rezervasyon için)
 * Requirements: 6.1, 6.2
 */
export function useCustomerInfoForReservation(customerId: string) {
  return useQuery({
    queryKey: reservationKeys.customerInfo(customerId),
    queryFn: async () => {
      const response = await reservationsApi.getCustomerInfoForReservation(
        customerId
      );
      return response.data;
    },
    enabled: !!customerId,
  });
}

/**
 * Tüm etkinlikleri getir (dropdown için)
 */
export function useEvents() {
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await eventsApi.getAll();
      // API response formatı: { items: [], meta: {} } veya doğrudan array
      const data = response.data;
      return (Array.isArray(data) ? data : data?.items || []) as Event[];
    },
    enabled: !!token,
  });
}

/**
 * Tüm misafirleri getir (dropdown için)
 */
export function useCustomers() {
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await customersApi.getAll();
      return response.data as Customer[];
    },
    enabled: !!token,
  });
}

/**
 * Misafir ara
 */
export function useSearchCustomers(query: string) {
  return useQuery({
    queryKey: ["customers", "search", query],
    queryFn: async () => {
      const response = await customersApi.search(query);
      return response.data as Customer[];
    },
    enabled: query.length >= 2,
  });
}
