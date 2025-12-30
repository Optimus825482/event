// Ekip Organizasyonu Tipleri

export type StaffPosition =
  | "supervizor"
  | "sef"
  | "garson"
  | "komi"
  | "debarasor";

// API'den gelen ham masa verisi
export interface RawTableData {
  id: string;
  tableNumber?: number | string;
  x?: number;
  y?: number;
  typeName?: string;
  type?: string;
  color?: string;
  capacity?: number;
  isLoca?: boolean;
  locaName?: string;
}

// Staff Assignment tipi
export interface StaffAssignment {
  id: string;
  staffId: string;
  eventId: string;
  tableIds: string[];
  teamId?: string;
  color?: string;
  isActive?: boolean;
}

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  color: string;
  position?: StaffPosition;
  avatar?: string;
  isActive: boolean;
}

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  color: string;
  position?: StaffPosition;
  avatar?: string;
}

export interface ServiceTeam {
  id: string;
  eventId: string;
  name: string;
  color: string;
  members: TeamMember[];
  leaderId?: string;
  tableIds: string[];
}

export interface TableGroup {
  id: string;
  eventId: string;
  name: string;
  color: string;
  tableIds: string[];
  assignedTeamId?: string;
  assignedSupervisorId?: string;
  groupType: string;
  sortOrder: number;
  notes?: string;
}

export interface TableData {
  id: string;
  label: string;
  x: number;
  y: number;
  typeName?: string;
  type?: string;
  color?: string;
  capacity?: number;
  isLoca?: boolean;
  locaName?: string;
}

export interface StageElement {
  id: string;
  type: "stage" | "catwalk1" | "catwalk2" | "system_control";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  isLocked?: boolean;
}

export interface EventData {
  id: string;
  name: string;
  eventDate: string;
  venueLayout?: {
    tables?: TableData[];
    placedTables?: TableData[];
    stageElements?: StageElement[];
    dimensions?: { width: number; height: number };
  };
}

export interface OrganizationSummary {
  totalStaff: number;
  totalTeams: number;
  totalTableGroups: number;
  assignedTables: number;
  unassignedTables: number;
  supervisorCount: number;
}

// Pozisyon etiketleri
export const POSITION_LABELS: Record<StaffPosition, string> = {
  supervizor: "Süpervizör",
  sef: "Şef",
  garson: "Garson",
  komi: "Komi",
  debarasor: "Debarasör",
};

// Pozisyon renkleri
export const POSITION_COLORS: Record<StaffPosition, string> = {
  supervizor: "bg-red-500/20 text-red-400 border-red-500/30",
  sef: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  garson: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  komi: "bg-green-500/20 text-green-400 border-green-500/30",
  debarasor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

// Grup tipleri
export const GROUP_TYPES = [
  { value: "standard", label: "Standart", color: "#3b82f6" },
  { value: "vip", label: "VIP", color: "#ef4444" },
  { value: "terrace", label: "Teras", color: "#22c55e" },
  { value: "indoor", label: "İç Mekan", color: "#8b5cf6" },
  { value: "outdoor", label: "Dış Mekan", color: "#f59e0b" },
  { value: "bar", label: "Bar", color: "#06b6d4" },
  { value: "lounge", label: "Lounge", color: "#ec4899" },
];

// Varsayılan renkler
export const DEFAULT_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

// Masa tipi renkleri (venue ile aynı)
export const TABLE_TYPE_COLORS: Record<string, { bg: string; border: string }> =
  {
    unassigned: { bg: "#6b7280", border: "#9ca3af" },
    standard: { bg: "#3b82f6", border: "#60a5fa" },
    premium: { bg: "#8b5cf6", border: "#a78bfa" },
    vip: { bg: "#f59e0b", border: "#fbbf24" },
    loca: { bg: "#ec4899", border: "#f472b6" },
  };
