/**
 * React Query Hooks for Staff API
 *
 * Provides:
 * - Automatic caching with stale-while-revalidate
 * - Background refetching
 * - Optimistic updates for mutations
 * - Team management hooks
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  position?: string;
  status?: string;
}

/**
 * Fetch all staff (paginated)
 */
export function useStaff(params: PaginationParams = {}) {
  const { page = 1, limit = 50, search, department, position, status } = params;

  return useQuery({
    queryKey: queryKeys.staff.list({
      page,
      limit,
      search,
      department,
      position,
      status,
    }),
    queryFn: async () => {
      const response = await staffApi.getAll();
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch single staff member by ID
 */
export function useStaffMember(id: string) {
  return useQuery({
    queryKey: queryKeys.staff.detail(id),
    queryFn: async () => {
      const response = await staffApi.getOne(id);
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Fetch all teams with members
 */
export function useTeams() {
  return useQuery({
    queryKey: queryKeys.staff.teams(),
    queryFn: async () => {
      const response = await staffApi.getAllTeams();
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - teams change less frequently
  });
}

/**
 * Fetch staff for event assignment
 */
export function useStaffForEvent(eventId: string) {
  return useQuery({
    queryKey: [...queryKeys.staff.all, "event", eventId],
    queryFn: async () => {
      const response = await staffApi.getForEvent(eventId);
      return response.data;
    },
    enabled: !!eventId,
  });
}

/**
 * Create staff member mutation
 */
export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await staffApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.lists() });
    },
  });
}

/**
 * Update staff member mutation
 */
export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await staffApi.update(id, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.staff.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.lists() });
    },
  });
}

/**
 * Delete staff member mutation
 */
export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await staffApi.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.lists() });
    },
  });
}

/**
 * Create team mutation
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await staffApi.createTeam(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.teams() });
    },
  });
}

/**
 * Update team mutation
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await staffApi.updateTeam(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.teams() });
    },
  });
}

/**
 * Delete team mutation
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await staffApi.deleteTeam(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.teams() });
    },
  });
}

/**
 * Add member to team mutation
 */
export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      staffId,
    }: {
      teamId: string;
      staffId: string;
    }) => {
      const response = await staffApi.addTeamMember(teamId, staffId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.teams() });
    },
  });
}

/**
 * Remove member from team mutation
 */
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      staffId,
    }: {
      teamId: string;
      staffId: string;
    }) => {
      const response = await staffApi.removeTeamMember(teamId, staffId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.teams() });
    },
  });
}

/**
 * Assign staff to event mutation
 */
export function useAssignStaffToEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      assignments,
    }: {
      eventId: string;
      assignments: any[];
    }) => {
      const response = await staffApi.assignToEvent(eventId, assignments);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.staff.all, "event", variables.eventId],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.events.detail(variables.eventId),
      });
    },
  });
}
