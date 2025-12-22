import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

/**
 * EventStats interface - Dashboard istatistikleri için
 * Requirement: 5.1
 */
export interface EventStats {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  noShow: number;
}

/**
 * CheckInRecord interface - Son check-in kayıtları için
 * Requirement: 5.3
 */
export interface CheckInRecord {
  reservationId: string;
  tableId: string;
  tableLabel?: string;
  customerName: string;
  guestCount: number;
  checkInTime: string;
}

@WebSocketGateway({
  cors: {
    origin: true, // Production'da tüm origin'lere izin ver (Coolify reverse proxy arkasında)
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, { eventId?: string; role?: string }> =
    new Map();

  handleConnection(client: Socket) {
    this.connectedClients.set(client.id, {});
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
  }

  // Etkinlik odasına katıl
  @SubscribeMessage("joinEvent")
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; role: string }
  ) {
    client.join(`event:${data.eventId}`);
    this.connectedClients.set(client.id, {
      eventId: data.eventId,
      role: data.role,
    });
    return { success: true, message: `Joined event ${data.eventId}` };
  }

  // Masa güncelleme (sürükle-bırak)
  @SubscribeMessage("tableMove")
  handleTableMove(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      eventId: string;
      tableId: string;
      x: number;
      y: number;
      rotation: number;
    }
  ) {
    // Aynı etkinlikteki diğer kullanıcılara yayınla
    client.to(`event:${data.eventId}`).emit("tableUpdated", {
      tableId: data.tableId,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      updatedBy: client.id,
    });
    return { success: true };
  }

  // Rezervasyon güncelleme
  @SubscribeMessage("reservationUpdate")
  handleReservationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; reservation: unknown }
  ) {
    this.server
      .to(`event:${data.eventId}`)
      .emit("reservationChanged", data.reservation);
    return { success: true };
  }

  /**
   * Check-in bildirimi - Real-time güncelleme
   * Requirement: 5.2 - Check-in event'lerini broadcast et
   * @param client Socket client
   * @param data Check-in verisi
   */
  @SubscribeMessage("checkIn")
  handleCheckIn(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      eventId: string;
      reservationId: string;
      tableId: string;
      tableLabel?: string;
      customerName?: string;
      guestCount?: number;
    }
  ) {
    const checkInRecord: CheckInRecord = {
      reservationId: data.reservationId,
      tableId: data.tableId,
      tableLabel: data.tableLabel,
      customerName: data.customerName || "Bilinmeyen Misafir",
      guestCount: data.guestCount || 1,
      checkInTime: new Date().toISOString(),
    };

    // Tüm event katılımcılarına check-in bildirimini gönder
    this.server
      .to(`event:${data.eventId}`)
      .emit("guestCheckedIn", checkInRecord);

    return { success: true, checkInRecord };
  }

  /**
   * Canlı istatistikleri broadcast et
   * Requirement: 5.2 - Stats güncellemelerini push et (2 saniye içinde)
   * @param eventId Event ID
   * @param stats EventStats objesi
   */
  broadcastStats(eventId: string, stats: EventStats): void {
    this.server.to(`event:${eventId}`).emit("liveStats", {
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check-in sonrası istatistikleri otomatik güncelle
   * Requirement: 5.2 - Check-in sonrası 2 saniye içinde güncelleme
   * @param eventId Event ID
   * @param stats Güncel istatistikler
   * @param checkInRecord Son check-in kaydı
   */
  broadcastCheckInWithStats(
    eventId: string,
    stats: EventStats,
    checkInRecord: CheckInRecord
  ): void {
    // Önce check-in bildirimini gönder
    this.server.to(`event:${eventId}`).emit("guestCheckedIn", checkInRecord);

    // Ardından güncel istatistikleri gönder
    this.server.to(`event:${eventId}`).emit("liveStats", {
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Son check-in geçmişini broadcast et
   * Requirement: 5.3 - Recent check-in history
   * @param eventId Event ID
   * @param recentCheckIns Son check-in kayıtları
   */
  broadcastRecentCheckIns(
    eventId: string,
    recentCheckIns: CheckInRecord[]
  ): void {
    this.server.to(`event:${eventId}`).emit("recentCheckIns", {
      checkIns: recentCheckIns,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Bağlı client sayısını getir (debug için)
   * @param eventId Event ID
   * @returns Bağlı client sayısı
   */
  getConnectedClientsCount(eventId: string): number {
    let count = 0;
    this.connectedClients.forEach((data) => {
      if (data.eventId === eventId) count++;
    });
    return count;
  }
}
