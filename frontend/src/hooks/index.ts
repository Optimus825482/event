/**
 * React Query Hooks - Centralized Exports
 *
 * All API hooks with automatic caching, background refetching,
 * and optimistic updates.
 */

// Events Hooks
export {
  useEvents,
  useEvent,
  useCreateEvent,
  useUpdateEvent,
  useUpdateEventLayout,
  useDeleteEvent,
} from "./useEvents";

// Customers Hooks
export {
  useCustomers,
  useCustomer,
  useCustomerWithNotes,
  useCustomerSearch,
  useCreateCustomer,
  useUpdateCustomer,
  useAddCustomerNote,
  useToggleBlacklist,
  useDeleteCustomer,
} from "./useCustomers";

// Staff Hooks
export {
  useStaff,
  useStaffMember,
  useTeams,
  useStaffForEvent,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useAssignStaffToEvent,
} from "./useStaff";

// PWA Hook
export { usePWA } from "./usePWA";
