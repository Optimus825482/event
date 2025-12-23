import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

// Socket event tipleri
export interface TableUpdateData {
  tableId: string;
  x: number;
  y: number;
  rotation: number;
  updatedBy?: string;
}

export interface ReservationData {
  id: string;
  tableId: string;
  customerId?: string;
  customerName?: string;
  guestCount: number;
  status: string;
  notes?: string;
}

export interface CheckInData {
  reservationId: string;
  tableId: string;
  tableLabel?: string;
  customerName: string;
  guestCount: number;
  checkInTime: string;
}

export interface LiveStatsData {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  noShow: number;
  timestamp: string;
}

// Bildirim payload tipi
export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  targetRole: string;
  eventId?: string | null;
  actionUrl?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

class SocketService {
  private socket: Socket | null = null;
  private eventId: string | null = null;
  private userId: string | null = null;
  private userRole: string | null = null;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      // Socket bağlantısı kuruldu - kullanıcı bilgisi varsa odaya katıl
      if (this.userId && this.userRole) {
        this.joinUserRoom(this.userId, this.userRole);
      }
    });

    this.socket.on("disconnect", () => {
      // Socket bağlantısı kesildi
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Kullanıcı bildirim odasına katıl
  joinUserRoom(userId: string, role: string) {
    this.userId = userId;
    this.userRole = role;
    this.socket?.emit("joinUser", { userId, role });
  }

  joinEvent(eventId: string, role: string = "organizer") {
    this.eventId = eventId;
    this.socket?.emit("joinEvent", { eventId, role });
  }

  leaveEvent() {
    this.eventId = null;
  }

  // Masa güncelleme gönder
  emitTableMove(tableId: string, x: number, y: number, rotation: number) {
    if (!this.eventId) return;
    this.socket?.emit("tableMove", {
      eventId: this.eventId,
      tableId,
      x,
      y,
      rotation,
    });
  }

  // Alias - TableShape.tsx uyumluluğu için
  sendTableMove(tableId: string, x: number, y: number, rotation: number) {
    this.emitTableMove(tableId, x, y, rotation);
  }

  // Rezervasyon güncelleme gönder
  emitReservationUpdate(reservation: ReservationData) {
    if (!this.eventId) return;
    this.socket?.emit("reservationUpdate", {
      eventId: this.eventId,
      reservation,
    });
  }

  // Check-in gönder
  emitCheckIn(reservationId: string, tableId: string) {
    if (!this.eventId) return;
    this.socket?.emit("checkIn", {
      eventId: this.eventId,
      reservationId,
      tableId,
    });
  }

  // Event listeners
  onTableUpdated(callback: (data: TableUpdateData) => void) {
    this.socket?.on("tableUpdated", callback);
  }

  onReservationChanged(callback: (data: ReservationData) => void) {
    this.socket?.on("reservationChanged", callback);
  }

  onGuestCheckedIn(callback: (data: CheckInData) => void) {
    this.socket?.on("guestCheckedIn", callback);
  }

  onLiveStats(callback: (data: LiveStatsData) => void) {
    this.socket?.on("liveStats", callback);
  }

  // Remove listeners
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }

  // Canvas için check-in güncellemelerini dinle (Requirement 8.4)
  onTableCheckIn(
    callback: (data: {
      tableId: string;
      reservationId: string;
      status: string;
    }) => void
  ) {
    this.socket?.on("tableCheckIn", callback);
  }

  // Canvas için rezervasyon güncellemelerini dinle
  onTableReservationUpdate(
    callback: (data: { tableId: string; reservation: ReservationData }) => void
  ) {
    this.socket?.on("tableReservationUpdate", callback);
  }

  // ==================== NOTIFICATION METHODS ====================

  // Yeni bildirim dinleyicisi
  onNewNotification(callback: (data: NotificationPayload) => void) {
    this.socket?.on("newNotification", callback);
  }

  // Bildirim dinleyicisini kaldır
  offNewNotification() {
    this.socket?.off("newNotification");
  }

  // Bağlantı durumunu kontrol et
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Socket instance'ını al (advanced kullanım için)
  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
