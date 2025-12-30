// Masa Türü
export interface TableType {
  id: string;
  name: string;
  capacity: number;
  color: string;
  shape: "round" | "rectangle" | "square";
}

// Canvas üzerindeki Masa
export interface TableInstance {
  id: string;
  typeId: string;
  typeName: string;
  x: number;
  y: number;
  rotation: number;
  capacity: number;
  color: string;
  shape: string;
  label: string;
  reservationId?: string;
  staffId?: string;
  staffColor?: string;
}

// Canvas Masa (canvasStore için alias)
export interface CanvasTable extends TableInstance {
  tableType?: TableType;
  status?: "available" | "reserved" | "occupied";
}

// Etkinlik
export interface Event {
  id: string;
  name: string;
  eventDate: string;
  venueLayout: VenueLayout;
  status: "draft" | "published" | "active" | "completed";
  organizerId: string;
  totalCapacity: number;
  createdAt: string;
  updatedAt: string;
}

// Mekan Yerleşimi
export interface VenueLayout {
  width: number;
  height: number;
  tables: TableInstance[];
  walls: Wall[];
  stage?: Stage;
  gridSize: number;
  zones?: Zone[];
}

// Alan/Bölge (System Kontrol, Loca alanı, Sahne vb.)
export interface Zone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  type:
    | "system"
    | "loca"
    | "vip"
    | "premium"
    | "standard"
    | "other"
    | "stage"
    | "stage-extension"
    | "stage-end"
    | "info"
    | "frame";
}

// Duvar/Çizgi
export interface Wall {
  id: string;
  points: number[]; // [x1, y1, x2, y2, ...]
  strokeWidth: number;
  color: string;
  label?: string; // Etiket: 'stage', 'bar', 'entrance', 'exit', 'dj', 'wc' vb.
}

// Sahne
export interface Stage {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

// Misafir
export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  vipScore: number;
  tags: string[];
  isBlacklisted: boolean;
  totalEvents: number;
  notes?: string;
  // Yeni alanlar
  lastEventDate?: string;
  lastEventId?: string;
  totalAttendedEvents: number;
  totalReservations: number;
  noShowCount: number;
  noteCount?: number; // API'den gelir
}

// Misafir Notu
export type GuestNoteType =
  | "pre_event"
  | "during_event"
  | "post_event"
  | "general";

export interface GuestNote {
  id: string;
  customerId: string;
  eventId?: string;
  reservationId?: string;
  content: string;
  noteType: GuestNoteType;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  event?: Event;
}

// Rezervasyon Status
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "cancelled"
  | "no_show";

// Rezervasyon
export interface Reservation {
  id: string;
  eventId: string;
  tableId: string;
  customerId?: string;
  customer?: Customer;
  event?: Event;
  guestCount: number;
  qrCodeHash: string;
  status: ReservationStatus;
  checkInTime?: string;
  specialRequests?: string;
  totalAmount: number;
  isPaid: boolean;
  // Misafir kaydı olmadan direkt misafir bilgileri
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  createdAt: string;
  updatedAt: string;
}

// Rezervasyon Filtreleri
export interface ReservationFilters {
  eventId?: string;
  customerId?: string;
  status?: ReservationStatus;
  searchQuery?: string;
  tableId?: string;
}

// Rezervasyon Oluşturma DTO
export interface CreateReservationDto {
  eventId: string;
  tableId: string;
  customerId?: string;
  guestCount: number;
  specialRequests?: string;
  totalAmount?: number;
  // Misafir kaydı olmadan direkt misafir bilgileri
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
}

// Rezervasyon Güncelleme DTO
export interface UpdateReservationDto {
  tableId?: string;
  guestCount?: number;
  status?: ReservationStatus;
  specialRequests?: string;
  totalAmount?: number;
  isPaid?: boolean;
}

// Event İstatistikleri
export interface EventStats {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  noShow: number;
}

// QR Kod Sonucu
export interface QRCodeResult {
  qrCodeDataUrl: string;
  content: {
    eventId: string;
    tableId: string;
    qrCodeHash: string;
  };
  reservation: Reservation;
}

// Personel Ataması
export interface StaffAssignment {
  id: string;
  eventId: string;
  staffId: string;
  staffName: string;
  staffColor: string;
  assignedTableIds: string[];
}

// Kullanıcı
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "organizer" | "staff" | "venue_owner";
  avatar?: string;
  color?: string;
}

// Mekan Şablonu
export interface VenueTemplate {
  id: string;
  name: string;
  layoutData: VenueLayout;
  isPublic: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: string;
}

// ==================== PERSONNEL (HR STAFF) ====================

// Cinsiyet
export type Gender = "male" | "female";

// Personel Durumu
export type StaffStatus = "active" | "inactive" | "terminated";

// Personel (HR Staff tablosundan)
export interface Personnel {
  id: string;
  sicilNo: string;
  fullName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  position: string;
  department?: string;
  workLocation?: string;
  mentor?: string;
  color?: string;
  gender?: Gender;
  birthDate?: string;
  age?: number;
  bloodType?: string;
  shoeSize?: number;
  sockSize?: string;
  hireDate?: string;
  terminationDate?: string;
  terminationReason?: string;
  yearsAtCompany?: number;
  isActive: boolean;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
}

// Personel Oluşturma DTO
export interface CreatePersonnelDto {
  sicilNo: string;
  fullName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  position: string;
  department?: string;
  workLocation?: string;
  mentor?: string;
  color?: string;
  gender?: Gender;
  birthDate?: string;
  age?: number;
  bloodType?: string;
  shoeSize?: number;
  sockSize?: string;
  hireDate?: string;
  terminationDate?: string;
  terminationReason?: string;
  yearsAtCompany?: number;
  isActive?: boolean;
  status?: StaffStatus;
}

// Personel Güncelleme DTO
export interface UpdatePersonnelDto extends Partial<CreatePersonnelDto> {}

// Personel İstatistikleri
export interface PersonnelStats {
  total: number;
  active: number;
  inactive: number;
  terminated: number;
  byDepartment: Record<string, number>;
  byWorkLocation: Record<string, number>;
  byPosition: Record<string, number>;
  byGender: Record<string, number>;
}

// Personel Filtreleri
export interface PersonnelFilters {
  department?: string;
  workLocation?: string;
  position?: string;
  isActive?: boolean;
  status?: StaffStatus;
}
