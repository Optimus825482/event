/**
 * React Query Configuration
 *
 * Centralized query client configuration for:
 * - API caching
 * - Stale-while-revalidate pattern
 * - Optimistic updates
 * - Error handling
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate pattern
      staleTime: 60 * 1000, // 60 seconds - data considered fresh
      gcTime: 5 * 60 * 1000, // 5 minutes - garbage collection time (renamed from cacheTime)

      // Retry configuration
      retry: 1, // Retry failed requests once
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch configuration
      refetchOnWindowFocus: false, // Don't refetch on window focus (annoying in dev)
      refetchOnReconnect: true, // Refetch on network reconnect
      refetchOnMount: true, // Refetch on component mount
    },
    mutations: {
      // Retry mutations once
      retry: 1,

      // Error handling
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});

/**
 * Query Keys Factory
 * Centralized query key management
 */
export const queryKeys = {
  // Events
  events: {
    all: ["events"] as const,
    lists: () => [...queryKeys.events.all, "list"] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.events.lists(), filters] as const,
    details: () => [...queryKeys.events.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.events.details(), id] as const,
  },

  // Customers
  customers: {
    all: ["customers"] as const,
    lists: () => [...queryKeys.customers.all, "list"] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.customers.lists(), filters] as const,
    details: () => [...queryKeys.customers.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
  },

  // Staff
  staff: {
    all: ["staff"] as const,
    lists: () => [...queryKeys.staff.all, "list"] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.staff.lists(), filters] as const,
    details: () => [...queryKeys.staff.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.staff.details(), id] as const,
    teams: () => [...queryKeys.staff.all, "teams"] as const,
  },

  // Venues
  venues: {
    all: ["venues"] as const,
    lists: () => [...queryKeys.venues.all, "list"] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.venues.lists(), filters] as const,
  },

  // Reservations
  reservations: {
    all: ["reservations"] as const,
    lists: () => [...queryKeys.reservations.all, "list"] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.reservations.lists(), filters] as const,
    details: () => [...queryKeys.reservations.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.reservations.details(), id] as const,
  },
};
