// Analiz sonucu tipleri
export interface ParsedStaffAssignment {
  staffName: string;
  staffId?: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  groupName: string;
  groupColor: string;
  assignmentType: "table" | "loca" | "bar" | "special";
  position?: string;
  matchConfidence: number; // 0-100 arası eşleşme güveni
  matchedStaff?: { id: string; fullName: string };
  warnings?: string[];
}

export interface ParsedGroup {
  name: string;
  color: string;
  tableIds: string[];
  groupType: "standard" | "loca";
  assignments: ParsedStaffAssignment[];
}

// Hizmet Noktası Personel Ataması
export interface ParsedServicePointAssignment {
  staffName: string;
  staffId?: string;
  shiftStart: string;
  shiftEnd: string;
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

// Hizmet Noktası (Bar, Depo, vb.)
export interface ParsedServicePoint {
  name: string;
  pointType: "bar" | "depo" | "fuaye" | "casino" | "other";
  color: string;
  assignments: ParsedServicePointAssignment[];
}

// Extra Personel (Event'e özel, staff tablosunda olmayan)
export interface ParsedExtraPersonnel {
  staffName: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isBackground?: boolean; // BACKROUND olarak işaretlenenler
}

// Destek Ekibi Personeli (Dışarıdan gelen destek - CRYSTAL, vb.)
export interface ParsedSupportTeamMember {
  staffName: string;
  position: string; // SPVR, CAPTAIN, PERSONEL
  assignment: string; // POSTA 3, 16-17-26-27, BAR, GENEL ALAN KONTROL
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isNotComing?: boolean; // GELMEYECEK olarak işaretlenenler
}

// Destek Ekibi (CRYSTAL DESTEK EKİBİ, vb.)
export interface ParsedSupportTeam {
  name: string; // CRYSTAL DESTEK EKİBİ
  color: string;
  members: ParsedSupportTeamMember[];
}

// Kaptan (Takım kaptanları - gruplar birleştirildiğinde atanacak)
export interface ParsedCaptain {
  staffName: string;
  staffId?: string;
  position: "CAPTAIN" | "J. CAPTAIN" | "INCHARGE"; // Kaptan türü
  shiftStart: string;
  shiftEnd: string;
  area?: string; // SALON, LOCA gibi sorumluluk alanı
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

// Süpervizör (1'den fazla takıma atanabilir)
export interface ParsedSupervisor {
  staffName: string;
  staffId?: string;
  position: "SPVR";
  shiftStart: string;
  shiftEnd: string;
  area?: string; // LOCA, SALON gibi sorumluluk alanı
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

// Loca Kaptanı (Loca takımlarının kaptanları)
export interface ParsedLocaCaptain {
  staffName: string;
  staffId?: string;
  shiftStart: string;
  shiftEnd: string;
  area?: string; // SALON notu varsa
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

export interface AnalysisResult {
  eventId: string;
  eventName?: string;
  totalGroups: number;
  totalAssignments: number;
  groups: ParsedGroup[];
  servicePoints: ParsedServicePoint[]; // Hizmet noktaları
  extraPersonnel: ParsedExtraPersonnel[]; // Extra personeller
  supportTeams: ParsedSupportTeam[]; // Destek ekipleri
  captains: ParsedCaptain[]; // Takım kaptanları
  supervisors: ParsedSupervisor[]; // Süpervizörler
  locaCaptains: ParsedLocaCaptain[]; // Loca kaptanları
  unmatchedStaff: string[];
  warnings: string[];
  aiParsed?: boolean; // AI ile parse edildi mi?
  aiResult?: import("./ai-excel-parser.service").AIExcelParseResult; // AI sonuçları (debug için)
  summary: {
    tableGroups: number;
    locaGroups: number;
    servicePoints: number;
    extraPersonnel: number;
    supportTeamMembers: number;
    captains: number;
    supervisors: number;
    locaCaptains: number;
    matchedStaff: number;
    unmatchedStaff: number;
  };
}

// Parsing sonuç tipi (parser ve merger servisleri arasında paylaşılan)
export interface ParseResult {
  groups: ParsedGroup[];
  servicePoints: ParsedServicePoint[];
  extraPersonnel: ParsedExtraPersonnel[];
  supportTeams: ParsedSupportTeam[];
  captains: ParsedCaptain[];
  supervisors: ParsedSupervisor[];
  locaCaptains: ParsedLocaCaptain[];
  unmatchedStaff: string[];
  warnings: string[];
}

// ViewerPro parse sonucu (subset)
export interface ViewerProParseResult {
  groups: ParsedGroup[];
  servicePoints: ParsedServicePoint[];
  extraPersonnel: ParsedExtraPersonnel[];
  unmatchedStaff: string[];
  warnings: string[];
}

// Grup renkleri paleti
export const GROUP_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8B500",
  "#E74C3C",
  "#1ABC9C",
  "#9B59B6",
  "#3498DB",
  "#E67E22",
  "#2ECC71",
  "#F39C12",
  "#8E44AD",
  "#16A085",
  "#D35400",
  "#27AE60",
  "#2980B9",
  "#C0392B",
  "#7D3C98",
  "#148F77",
  "#D68910",
  "#1F618D",
  "#922B21",
  "#76448A",
  "#117A65",
  "#B9770E",
  "#1A5276",
  "#7B241C",
  "#5B2C6F",
  "#0E6655",
];

// Hizmet noktası renkleri
export const SERVICE_POINT_COLORS: Record<string, string> = {
  bar: "#06b6d4", // Cyan
  depo: "#8b5cf6", // Purple
  fuaye: "#f59e0b", // Amber
  casino: "#ef4444", // Red
  other: "#64748b", // Slate
};
