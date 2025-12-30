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

/**
 * NotificationPayload interface - Real-time bildirimler için
 */
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

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<
    string,
    { eventId?: string; role?: string; userId?: string }
  > = new Map();

  handleConnection(client: Socket) {
    this.connectedClients.set(client.id, {});
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
  }

  // Kullanıcı odasına katıl (bildirimler için)
  @SubscribeMessage("joinUser")
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; role: string }
  ) {
    // Kullanıcı kendi odasına katılır
    client.join(`user:${data.userId}`);
    // Role bazlı odaya da katılır
    client.join(`role:${data.role}`);
    // Genel bildirimler için
    client.join("notifications:all");

    const clientData = this.connectedClients.get(client.id) || {};
    this.connectedClients.set(client.id, {
      ...clientData,
      userId: data.userId,
      role: data.role,
    });

    return {
      success: true,
      message: `User ${data.userId} joined notification channels`,
    };
  }

  // Etkinlik odasına katıl
  @SubscribeMessage("joinEvent")
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; role: string }
  ) {
    client.join(`event:${data.eventId}`);
    const clientData = this.connectedClients.get(client.id) || {};
    this.connectedClients.set(client.id, {
      ...clientData,
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

  // ==================== NOTIFICATION METHODS ====================

  /**
   * Tüm kullanıcılara bildirim gönder
   * @param notification Bildirim payload'ı
   */
  broadcastNotificationToAll(notification: NotificationPayload): void {
    this.server.to("notifications:all").emit("newNotification", notification);
  }

  /**
   * Belirli bir role bildirim gönder
   * @param role Hedef rol (admin, leader, staff)
   * @param notification Bildirim payload'ı
   */
  broadcastNotificationToRole(
    role: string,
    notification: NotificationPayload
  ): void {
    this.server.to(`role:${role}`).emit("newNotification", notification);
  }

  /**
   * Belirli bir kullanıcıya bildirim gönder
   * @param userId Hedef kullanıcı ID
   * @param notification Bildirim payload'ı
   */
  broadcastNotificationToUser(
    userId: string,
    notification: NotificationPayload
  ): void {
    this.server.to(`user:${userId}`).emit("newNotification", notification);
  }

  /**
   * Hedef role göre bildirim gönder
   * @param targetRole Hedef rol (all, admin, leader, staff)
   * @param notification Bildirim payload'ı
   */
  broadcastNotification(
    targetRole: string,
    notification: NotificationPayload
  ): void {
    if (targetRole === "all") {
      this.broadcastNotificationToAll(notification);
    } else {
      // Hem role özel hem de all kanalına gönder
      this.broadcastNotificationToRole(targetRole, notification);
    }
  }
}
