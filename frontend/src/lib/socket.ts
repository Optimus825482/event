import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

class SocketService {
  private socket: Socket | null = null;
  private eventId: string | null = null;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      console.log("🔌 Socket connected:", this.socket?.id);
    });

    this.socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
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
  emitReservationUpdate(reservation: any) {
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
  onTableUpdated(callback: (data: any) => void) {
    this.socket?.on("tableUpdated", callback);
  }

  onReservationChanged(callback: (data: any) => void) {
    this.socket?.on("reservationChanged", callback);
  }

  onGuestCheckedIn(callback: (data: any) => void) {
    this.socket?.on("guestCheckedIn", callback);
  }

  onLiveStats(callback: (data: any) => void) {
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
    callback: (data: { tableId: string; reservation: any }) => void
  ) {
    this.socket?.on("tableReservationUpdate", callback);
  }
}

export const socketService = new SocketService();
