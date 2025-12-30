// Staff modülü tip tanımlamaları
import { Personnel, PersonnelStats } from "@/types";

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  color?: string;
  position?: string;
  department?: string;
  avatar?: string;
  isActive: boolean;
  status?: "active" | "inactive" | "left";
  createdAt: string;
  assignedTables?: string[];
}

export interface Team {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  members?: Staff[];
  leaderId?: string;
  leader?: Staff;
  sortOrder: number;
  isActive: boolean;
  assignedGroupCount?: number;
  assignedTableCount?: number;
}

export interface Event {
  id: string;
  name: string;
  date?: string;
  eventDate?: string;
  time?: string;
  status: "planning" | "ready" | "completed" | "cancelled";
  venue?: { name: string };
  hasTeamAssignment?: boolean;
  hasVenueLayout?: boolean;
  venueLayout?: { placedTables?: any[] };
}

export interface WorkShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface StaffReview {
  id: string;
  staffId: string;
  eventId: string;
  reviewerId: string;
  overallScore: number;
  punctualityScore: number;
  attitudeScore: number;
  teamworkScore: number;
  efficiencyScore: number;
  comment?: string;
  isCompleted: boolean;
  createdAt: string;
  event?: { id: string; name: string; eventDate: string };
  reviewer?: { id: string; fullName: string };
}

export interface Role {
  id?: string;
  key: string;
  label: string;
  color: string;
  badgeColor: string;
  bgColor: string;
}

export interface DepartmentSummary {
  department: string;
  count: number;
  activeCount: number;
  sortOrder?: number;
}

export interface Position {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  color?: string;
}

export interface WorkLocation {
  id: string;
  name: string;
}

export const EVENT_STATUS_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  planning: {
    label: "Planlama",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  ready: {
    label: "Hazır",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  completed: {
    label: "Tamamlandı",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  cancelled: {
    label: "İptal",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

// Re-export Personnel types
export type { Personnel, PersonnelStats };
