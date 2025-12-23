import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";
import { NotificationType } from "../../entities/notification.entity";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Kullanıcının bildirimlerini getir
  @Get()
  async getUserNotifications(
    @Request() req: { user: { id: string } },
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("unreadOnly") unreadOnly?: string
  ) {
    return this.notificationsService.getUserNotifications(req.user.id, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      unreadOnly: unreadOnly === "true",
    });
  }

  // Okunmamış bildirim sayısı
  @Get("unread-count")
  async getUnreadCount(@Request() req: { user: { id: string } }) {
    const result = await this.notificationsService.getUserNotifications(
      req.user.id,
      { limit: 1 }
    );
    return { unreadCount: result.unreadCount };
  }

  // Tek bildirim detayı
  @Get(":id")
  async getNotification(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } }
  ) {
    return this.notificationsService.getNotificationById(id, req.user.id);
  }

  // Bildirimi okundu olarak işaretle
  @Post(":id/read")
  async markAsRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: { user: { id: string } }
  ) {
    await this.notificationsService.markAsRead(id, req.user.id);
    return { success: true };
  }

  // Tüm bildirimleri okundu olarak işaretle
  @Post("mark-all-read")
  async markAllAsRead(@Request() req: { user: { id: string } }) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }

  // ============ ADMIN ENDPOINTS ============

  // Tüm bildirimleri getir (admin)
  @Get("admin/all")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllNotifications(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("type") type?: NotificationType
  ) {
    return this.notificationsService.getAllNotifications({
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      type,
    });
  }

  // Bildirim istatistikleri (admin)
  @Get("admin/:id/stats")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getNotificationStats(@Param("id", ParseUUIDPipe) id: string) {
    return this.notificationsService.getNotificationStats(id);
  }

  // Bildirimi sil (admin)
  @Post("admin/:id/delete")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteNotification(@Param("id", ParseUUIDPipe) id: string) {
    await this.notificationsService.deleteNotification(id);
    return { success: true };
  }
}
