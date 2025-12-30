/**
 * React Query Hooks for Customers API
 *
 * Provides:
 * - Automatic caching with stale-while-revalidate
 * - Background refetching
 * - Optimistic updates for mutations
 * - Full-text search support
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Fetch customers with stats (paginated)
 */
export function useCustomers(params: PaginationParams = {}) {
  const { page = 1, limit = 50, search } = params;

  return useQuery({
    queryKey: queryKeys.customers.list({ page, limit, search }),
    queryFn: async () => {
      const response = await customersApi.getAllWithStats(search, page, limit);
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch single customer by ID
 */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: async () => {
      const response = await customersApi.getOne(id);
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Fetch customer with notes
 */
export function useCustomerWithNotes(id: string) {
  return useQuery({
    queryKey: [...queryKeys.customers.detail(id), "notes"],
    queryFn: async () => {
      const response = await customersApi.getWithNotes(id);
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Search customers for autocomplete (debounced)
 */
export function useCustomerSearch(query: string, limit = 5) {
  return useQuery({
    queryKey: ["customers", "search", query, limit],
    queryFn: async () => {
      if (!query || query.length < 4) return [];
      const response = await customersApi.searchAutocomplete(query, limit);
      return response.data;
    },
    enabled: query.length >= 4,
    staleTime: 30 * 1000, // 30 seconds for search results
  });
}

/**
 * Create customer mutation
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await customersApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });
}

/**
 * Update customer mutation
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await customersApi.update(id, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });
}

/**
 * Add customer note mutation
 */
export function useAddCustomerNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      data,
    }: {
      customerId: string;
      data: { content: string; noteType?: string; eventId?: string };
    }) => {
      const response = await customersApi.addNote(customerId, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          ...queryKeys.customers.detail(variables.customerId),
          "notes",
        ],
      });
    },
  });
}

/**
 * Toggle blacklist mutation
 */
export function useToggleBlacklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await customersApi.toggleBlacklist(id);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });
}

/**
 * Delete customer mutation
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await customersApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });
}
