/**
 * React Query Hooks for Events API
 *
 * Provides:
 * - Automatic caching
 * - Background refetching
 * - Optimistic updates
 * - Error handling
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * Fetch all events with pagination
 */
export function useEvents(page = 1, limit = 50) {
  return useQuery({
    queryKey: queryKeys.events.list({ page, limit }),
    queryFn: async () => {
      const response = await eventsApi.getAll(false); // useCache=false, React Query handles caching
      return response.data;
    },
  });
}

/**
 * Fetch single event by ID
 */
export function useEvent(id: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(id),
    queryFn: async () => {
      const response = await eventsApi.getOne(id);
      return response.data;
    },
    enabled: !!id, // Only fetch if ID exists
  });
}

/**
 * Create new event mutation
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await eventsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate events list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
    },
  });
}

/**
 * Update event mutation
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await eventsApi.update(id, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate specific event and lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
    },
  });
}

/**
 * Update event layout mutation with optimistic update
 */
export function useUpdateEventLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await eventsApi.updateLayout(id, data);
      return response.data;
    },
    // Optimistic update
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.events.detail(id),
      });

      // Snapshot previous value
      const previousEvent = queryClient.getQueryData(
        queryKeys.events.detail(id)
      );

      // Optimistically update
      queryClient.setQueryData(queryKeys.events.detail(id), (old: any) => ({
        ...old,
        venueLayout: data.venueLayout,
      }));

      return { previousEvent };
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousEvent) {
        queryClient.setQueryData(
          queryKeys.events.detail(variables.id),
          context.previousEvent
        );
      }
    },
    // Refetch on success
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(variables.id),
      });
    },
  });
}

/**
 * Delete event mutation
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await eventsApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate events list
      queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() });
    },
  });
}
