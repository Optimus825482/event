import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, { eventId?: string; role?: string }> = new Map();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, {});
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  // Etkinlik odasına katıl
  @SubscribeMessage('joinEvent')
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; role: string },
  ) {
    client.join(`event:${data.eventId}`);
    this.connectedClients.set(client.id, { eventId: data.eventId, role: data.role });
    console.log(`Client ${client.id} joined event:${data.eventId} as ${data.role}`);
    return { success: true, message: `Joined event ${data.eventId}` };
  }

  // Masa güncelleme (sürükle-bırak)
  @SubscribeMessage('tableMove')
  handleTableMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; tableId: string; x: number; y: number; rotation: number },
  ) {
    // Aynı etkinlikteki diğer kullanıcılara yayınla
    client.to(`event:${data.eventId}`).emit('tableUpdated', {
      tableId: data.tableId,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      updatedBy: client.id,
    });
    return { success: true };
  }

  // Rezervasyon güncelleme
  @SubscribeMessage('reservationUpdate')
  handleReservationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; reservation: any },
  ) {
    this.server.to(`event:${data.eventId}`).emit('reservationChanged', data.reservation);
    return { success: true };
  }

  // Check-in bildirimi
  @SubscribeMessage('checkIn')
  handleCheckIn(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; reservationId: string; tableId: string },
  ) {
    this.server.to(`event:${data.eventId}`).emit('guestCheckedIn', {
      reservationId: data.reservationId,
      tableId: data.tableId,
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }

  // Canlı istatistikler
  broadcastStats(eventId: string, stats: any) {
    this.server.to(`event:${eventId}`).emit('liveStats', stats);
  }
}
