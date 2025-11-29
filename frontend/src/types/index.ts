// Masa Türü
export interface TableType {
  id: string;
  name: string;
  capacity: number;
  color: string;
  shape: 'round' | 'rectangle' | 'square';
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
  status?: 'available' | 'reserved' | 'occupied';
}

// Etkinlik
export interface Event {
  id: string;
  name: string;
  eventDate: string;
  venueLayout: VenueLayout;
  status: 'draft' | 'published' | 'active' | 'completed';
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
  type: 'system' | 'loca' | 'vip' | 'premium' | 'standard' | 'other' | 'stage' | 'stage-extension' | 'stage-end' | 'info' | 'frame';
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

// Müşteri
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
}

// Rezervasyon
export interface Reservation {
  id: string;
  eventId: string;
  tableId: string;
  customerId: string;
  customer?: Customer;
  guestCount: number;
  qrCodeHash: string;
  checkInStatus: boolean;
  checkInTime?: string;
  notes?: string;
  createdAt: string;
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
  role: 'admin' | 'organizer' | 'staff' | 'venue_owner';
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
