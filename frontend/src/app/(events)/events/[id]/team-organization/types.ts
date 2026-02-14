// Team Organization Wizard Types

export type WizardStep =
  | "team-assignment" // Step 1: Grupları birleştirerek takım oluşturma
  | "staff-assignment" // Step 2: Personel atama + otomatik masa gruplama
  | "summary"; // Step 3: Özet görüntüleme + Kaydetme

export interface WizardStepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: string;
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: "team-assignment",
    title: "Takım Oluşturma",
    description: "Grupları birleştirerek takım oluşturun",
    icon: "Users",
  },
  {
    id: "staff-assignment",
    title: "Personel Atama",
    description: "Personel atayın, masalar otomatik gruplanır",
    icon: "UserPlus",
  },
  {
    id: "summary",
    title: "Özet & Kaydet",
    description: "Kontrol edin ve kaydedin",
    icon: "CheckCircle",
  },
];

// Masa Grubu
export interface TableGroup {
  id: string;
  name: string;
  color: string;
  tableIds: string[];
  assignedTeamId?: string;
  staffAssignments?: GroupStaffAssignment[];
}

// Grup Personel Ataması
export interface GroupStaffAssignment {
  id: string;
  staffId: string;
  staffName?: string; // Ekstra personel için ad soyad
  role: StaffRole;
  shiftId?: string; // WorkShift ID
  shiftStart: string; // "18:00"
  shiftEnd: string; // "02:00"
  isExtra?: boolean; // Ekstra personel mi?
}

// Çalışma Vardiyası (Backend'den gelen)
export interface WorkShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  eventId: string | null;
}

// Takım Tanımı
export interface TeamDefinition {
  id: string;
  name: string;
  color: string;
  requiredStaff: TeamStaffRequirement[];
  assignedGroupIds: string[];
  leaders?: TeamLeader[];
}

// Takım Lideri/Kaptan
export interface TeamLeader {
  staffId: string;
  staffName: string;
  role: string; // StaffRole veya custom string
  shiftStart?: string;
  shiftEnd?: string;
}

// Takım Personel Gereksinimi
export interface TeamStaffRequirement {
  role: StaffRole;
  count: number;
  assignedStaffIds: string[];
}

// Personel Rolleri
export type StaffRole =
  | "supervisor" // Süpervizör
  | "captain" // Kaptan/Şef
  | "waiter" // Garson
  | "runner" // Komi/Runner
  | "hostess" // Hostes
  | "barman"; // Barmen

export const STAFF_ROLES: { value: StaffRole; label: string; color: string }[] =
  [
    { value: "supervisor", label: "Süpervizör", color: "#ef4444" },
    { value: "captain", label: "Kaptan", color: "#f59e0b" },
    { value: "waiter", label: "Garson", color: "#3b82f6" },
    { value: "runner", label: "Komi", color: "#22c55e" },
    { value: "hostess", label: "Hostes", color: "#ec4899" },
    { value: "barman", label: "Barmen", color: "#06b6d4" },
  ];

// Önceden Tanımlı Vardiya Saatleri (Fallback - Backend'den gelmezse)
export interface ShiftPreset {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

// Özel vardiya seçeneği için sabit
export const CUSTOM_SHIFT_OPTION = {
  id: "custom",
  name: "Özel",
  startTime: "",
  endTime: "",
};

// Masa Verisi
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

// Personel
export interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  color: string;
  position?: string;
  workLocation?: string;
  department?: string;
  avatar?: string;
  isActive: boolean;
}

// Sahne Elementi
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

// Etkinlik Verisi
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

// Wizard State
export interface WizardState {
  currentStep: WizardStep;
  tableGroups: TableGroup[];
  teams: TeamDefinition[];
  isLoading: boolean;
  hasChanges: boolean;
  event: EventData | null;
  allStaff: Staff[];
  lastDraftSave?: Date;
}

// Varsayılan Renkler
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

// ==================== HİZMET NOKTASI TİPLERİ ====================

// Hizmet Noktası
export interface ServicePoint {
  id: string;
  eventId: string;
  name: string;
  pointType: string; // bar, lounge, reception, vip_area, backstage, other
  requiredStaffCount: number;
  allowedRoles: string[]; // barman, hostes, garson, barboy, security
  x: number;
  y: number;
  color: string;
  shape: string; // square, circle, rectangle
  description?: string;
  sortOrder: number;
  isActive: boolean;
  // Frontend için eklenen alanlar
  assignedStaffCount?: number;
  staffAssignments?: ServicePointStaffAssignment[];
}

// Hizmet Noktası Personel Ataması
export interface ServicePointStaffAssignment {
  id: string;
  eventId: string;
  servicePointId: string;
  staffId: string;
  role: string;
  shiftId?: string;
  shiftStart?: string;
  shiftEnd?: string;
  notes?: string;
  sortOrder: number;
  isActive: boolean;
  // Join'den gelen
  staff?: Staff;
}

// Hizmet Noktası Tipleri
export const SERVICE_POINT_TYPES = [
  { value: "bar", label: "Bar", color: "#06b6d4" },
  { value: "lounge", label: "VIP Lounge", color: "#f59e0b" },
  { value: "reception", label: "Karşılama", color: "#22c55e" },
  { value: "vip_area", label: "VIP Alan", color: "#a855f7" },
  { value: "backstage", label: "Backstage", color: "#6366f1" },
  { value: "other", label: "Diğer", color: "#64748b" },
];

// Hizmet Noktası Personel Görevleri
export const SERVICE_POINT_ROLES = [
  { value: "barman", label: "Barmen", color: "#06b6d4" },
  { value: "captain", label: "Bar / Restaurant Captain", color: "#f97316" },
  { value: "waiter", label: "Waiter / Waitress", color: "#3b82f6" },
  { value: "comis", label: "Comis", color: "#10b981" },
  { value: "hostes", label: "Hostes", color: "#ec4899" },
  { value: "garson", label: "Garson", color: "#3b82f6" },
  { value: "barboy", label: "Barboy", color: "#22c55e" },
  { value: "security", label: "Güvenlik", color: "#ef4444" },
  { value: "runner", label: "Runner", color: "#f59e0b" },
  { value: "supervisor", label: "Süpervizör", color: "#8b5cf6" },
];
