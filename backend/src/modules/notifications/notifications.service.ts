import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Notification,
  NotificationRead,
  NotificationType,
  NotificationPriority,
  NotificationTargetRole,
} from "../../entities/notification.entity";
import { User, UserRole } from "../../entities/user.entity";
import { Event } from "../../entities/event.entity";
import {
  RealtimeGateway,
  NotificationPayload,
} from "../realtime/realtime.gateway";

interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  targetRole?: NotificationTargetRole;
  eventId?: string;
  createdById?: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationRead)
    private notificationReadRepository: Repository<NotificationRead>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtimeGateway: RealtimeGateway
  ) {}

  // Bildirim oluştur
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      type: dto.type,
      title: dto.title,
      message: dto.message,
      priority: dto.priority || NotificationPriority.MEDIUM,
      targetRole: dto.targetRole || NotificationTargetRole.ALL,
      eventId: dto.eventId || null,
      createdById: dto.createdById || null,
      metadata: dto.metadata || null,
      actionUrl: dto.actionUrl || null,
      isActive: true,
    });

    const saved = await this.notificationRepository.save(notification);

    // WebSocket üzerinden anlık bildirim gönder
    try {
      const payload: NotificationPayload = {
        id: saved.id,
        type: saved.type,
        title: saved.title,
        message: saved.message,
        priority: saved.priority,
        targetRole: saved.targetRole,
        eventId: saved.eventId,
        actionUrl: saved.actionUrl,
        createdAt: saved.createdAt.toISOString(),
        metadata: saved.metadata,
      };
      this.realtimeGateway.broadcastNotification(saved.targetRole, payload);
    } catch (error) {
      console.error("[NOTIFICATION] WebSocket broadcast error:", error);
      // WebSocket hatası bildirim kaydını etkilemesin
    }

    return saved;
  }

  // Kullanıcının bildirimlerini getir
  async getUserNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    // Kullanıcının rolünü al
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı");
    }

    // Kullanıcının görebileceği rolleri belirle
    const targetRoles = [NotificationTargetRole.ALL];
    if (user.role === UserRole.ADMIN) {
      targetRoles.push(NotificationTargetRole.ADMIN);
    } else if (user.role === UserRole.LEADER) {
      targetRoles.push(NotificationTargetRole.LEADER);
    } else if (user.role === UserRole.STAFF) {
      targetRoles.push(NotificationTargetRole.STAFF);
    }

    // Bildirimleri çek
    const queryBuilder = this.notificationRepository
      .createQueryBuilder("notification")
      .leftJoinAndSelect("notification.event", "event")
      .leftJoinAndSelect("notification.createdBy", "createdBy")
      .leftJoin("notification.reads", "read", "read.userId = :userId", {
        userId,
      })
      .addSelect("read.id", "readId")
      .where("notification.isActive = :isActive", { isActive: true })
      .andWhere("notification.targetRole IN (:...targetRoles)", {
        targetRoles,
      });

    if (unreadOnly) {
      queryBuilder.andWhere("read.id IS NULL");
    }

    const total = await queryBuilder.getCount();

    const notifications = await queryBuilder
      .orderBy("notification.createdAt", "DESC")
      .skip(offset)
      .take(limit)
      .getMany();

    // Okunmamış sayısını hesapla
    const unreadCountQuery = this.notificationRepository
      .createQueryBuilder("notification")
      .leftJoin("notification.reads", "read", "read.userId = :userId", {
        userId,
      })
      .where("notification.isActive = :isActive", { isActive: true })
      .andWhere("notification.targetRole IN (:...targetRoles)", { targetRoles })
      .andWhere("read.id IS NULL");

    const unreadCount = await unreadCountQuery.getCount();

    // Her bildirim için okunma durumunu ekle
    const readNotificationIds = await this.notificationReadRepository.find({
      where: { userId },
      select: ["notificationId"],
    });
    const readIds = new Set(readNotificationIds.map((r) => r.notificationId));

    const notificationsWithReadStatus = notifications.map((n) => ({
      ...n,
      isRead: readIds.has(n.id),
    }));

    return {
      notifications: notificationsWithReadStatus as Notification[],
      total,
      unreadCount,
    };
  }

  // Bildirimi okundu olarak işaretle
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // Zaten okunmuş mu kontrol et
    const existing = await this.notificationReadRepository.findOne({
      where: { notificationId, userId },
    });

    if (!existing) {
      const read = this.notificationReadRepository.create({
        notificationId,
        userId,
      });
      await this.notificationReadRepository.save(read);
    }
  }

  // Tüm bildirimleri okundu olarak işaretle
  async markAllAsRead(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const targetRoles = [NotificationTargetRole.ALL];
    if (user.role === UserRole.ADMIN) {
      targetRoles.push(NotificationTargetRole.ADMIN);
    } else if (user.role === UserRole.LEADER) {
      targetRoles.push(NotificationTargetRole.LEADER);
    } else if (user.role === UserRole.STAFF) {
      targetRoles.push(NotificationTargetRole.STAFF);
    }

    // Okunmamış bildirimleri bul
    const unreadNotifications = await this.notificationRepository
      .createQueryBuilder("notification")
      .leftJoin("notification.reads", "read", "read.userId = :userId", {
        userId,
      })
      .where("notification.isActive = :isActive", { isActive: true })
      .andWhere("notification.targetRole IN (:...targetRoles)", { targetRoles })
      .andWhere("read.id IS NULL")
      .getMany();

    // Toplu okundu işaretle
    const reads = unreadNotifications.map((n) =>
      this.notificationReadRepository.create({
        notificationId: n.id,
        userId,
      })
    );

    if (reads.length > 0) {
      await this.notificationReadRepository.save(reads);
    }
  }

  // Tek bildirim detayı
  async getNotificationById(
    notificationId: string,
    userId: string
  ): Promise<Notification & { isRead: boolean }> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, isActive: true },
      relations: ["event", "createdBy"],
    });

    if (!notification) {
      throw new NotFoundException("Bildirim bulunamadı");
    }

    const read = await this.notificationReadRepository.findOne({
      where: { notificationId, userId },
    });

    return {
      ...notification,
      isRead: !!read,
    };
  }

  // Bildirimi sil (soft delete)
  async deleteNotification(notificationId: string): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      isActive: false,
    });
  }

  // Bildirim okunma istatistikleri (admin için)
  async getNotificationStats(notificationId: string): Promise<{
    notification: Notification;
    totalReads: number;
    readers: { userId: string; fullName: string; readAt: Date }[];
  }> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
      relations: ["event", "createdBy"],
    });

    if (!notification) {
      throw new NotFoundException("Bildirim bulunamadı");
    }

    const reads = await this.notificationReadRepository.find({
      where: { notificationId },
      relations: ["user"],
      order: { readAt: "DESC" },
    });

    return {
      notification,
      totalReads: reads.length,
      readers: reads.map((r) => ({
        userId: r.userId,
        fullName: r.user?.fullName || "Bilinmeyen",
        readAt: r.readAt,
      })),
    };
  }

  // Tüm bildirimleri getir (admin için)
  async getAllNotifications(
    options: {
      limit?: number;
      offset?: number;
      type?: NotificationType;
    } = {}
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { limit = 50, offset = 0, type } = options;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder("notification")
      .leftJoinAndSelect("notification.event", "event")
      .leftJoinAndSelect("notification.createdBy", "createdBy")
      .loadRelationCountAndMap("notification.readCount", "notification.reads")
      .where("notification.isActive = :isActive", { isActive: true });

    if (type) {
      queryBuilder.andWhere("notification.type = :type", { type });
    }

    const total = await queryBuilder.getCount();

    const notifications = await queryBuilder
      .orderBy("notification.createdAt", "DESC")
      .skip(offset)
      .take(limit)
      .getMany();

    return { notifications, total };
  }

  // ============ HELPER METHODS - Otomatik Bildirim Oluşturma ============

  // Yeni etkinlik oluşturulduğunda
  async notifyEventCreated(
    event: Event,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.EVENT_CREATED,
      title: "Yeni Etkinlik Oluşturuldu",
      message: `"${event.name}" etkinliği ${new Date(
        event.eventDate
      ).toLocaleDateString("tr-TR")} tarihinde planlandı.`,
      priority: NotificationPriority.HIGH,
      targetRole: NotificationTargetRole.ALL,
      eventId: event.id,
      createdById,
      actionUrl: `/events/${event.id}`,
    });
  }

  // Mekan yerleşimi tamamlandığında
  async notifyVenueLayoutCompleted(
    event: Event,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.VENUE_LAYOUT_COMPLETED,
      title: "Mekan Yerleşimi Tamamlandı",
      message: `"${event.name}" etkinliğinin mekan yerleşim planı tamamlandı.`,
      priority: NotificationPriority.MEDIUM,
      targetRole: NotificationTargetRole.ALL,
      eventId: event.id,
      createdById,
      actionUrl: `/events/${event.id}`,
    });
  }

  // Ekip organizasyonu tamamlandığında
  async notifyTeamOrganizationCompleted(
    event: Event,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.TEAM_ORGANIZATION_COMPLETED,
      title: "Ekip Organizasyonu Tamamlandı",
      message: `"${event.name}" etkinliğinin ekip organizasyonu tamamlandı.`,
      priority: NotificationPriority.MEDIUM,
      targetRole: NotificationTargetRole.ALL,
      eventId: event.id,
      createdById,
      actionUrl: `/events/${event.id}`,
    });
  }

  // Değerlendirme sistemi aktive edildiğinde
  async notifyReviewSystemActivated(
    event: Event,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.REVIEW_SYSTEM_ACTIVATED,
      title: "Değerlendirme Sistemi Aktif",
      message: `"${event.name}" etkinliği için personel değerlendirme sistemi aktive edildi.`,
      priority: NotificationPriority.HIGH,
      targetRole: NotificationTargetRole.LEADER,
      eventId: event.id,
      createdById,
      actionUrl: `/leader/events/${event.id}/review`,
    });
  }

  // Değerlendirme sistemi deaktive edildiğinde
  async notifyReviewSystemDeactivated(
    event: Event,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.REVIEW_SYSTEM_DEACTIVATED,
      title: "Değerlendirme Sistemi Kapatıldı",
      message: `"${event.name}" etkinliği için personel değerlendirme sistemi kapatıldı.`,
      priority: NotificationPriority.MEDIUM,
      targetRole: NotificationTargetRole.LEADER,
      eventId: event.id,
      createdById,
    });
  }

  // Rezervasyon sistemi aktive edildiğinde
  async notifyReservationSystemActivated(
    event: Event,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.RESERVATION_SYSTEM_ACTIVATED,
      title: "Rezervasyon Sistemi Aktif",
      message: `"${event.name}" etkinliği için rezervasyon sistemi aktive edildi.`,
      priority: NotificationPriority.HIGH,
      targetRole: NotificationTargetRole.ALL,
      eventId: event.id,
      createdById,
      actionUrl: `/events/${event.id}/reservations`,
    });
  }

  // Rezervasyon sistemi deaktive edildiğinde
  async notifyReservationSystemDeactivated(
    event: Event,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.RESERVATION_SYSTEM_DEACTIVATED,
      title: "Rezervasyon Sistemi Kapatıldı",
      message: `"${event.name}" etkinliği için rezervasyon sistemi kapatıldı.`,
      priority: NotificationPriority.MEDIUM,
      targetRole: NotificationTargetRole.ALL,
      eventId: event.id,
      createdById,
    });
  }

  // Personel değerlendirmesi tamamlandığında (admin'e bildirim)
  async notifyStaffReviewCompleted(
    event: Event,
    staffName: string,
    reviewerName: string,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.STAFF_REVIEW_COMPLETED,
      title: "Personel Değerlendirmesi Yapıldı",
      message: `"${event.name}" etkinliğinde ${staffName} için ${reviewerName} tarafından değerlendirme yapıldı.`,
      priority: NotificationPriority.LOW,
      targetRole: NotificationTargetRole.ADMIN,
      eventId: event.id,
      createdById,
      metadata: { staffName, reviewerName },
    });
  }

  // Ekip ataması değiştiğinde
  async notifyTeamAssignmentChanged(
    event: Event,
    teamName: string,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.TEAM_ASSIGNMENT_CHANGED,
      title: "Ekip Ataması Değişti",
      message: `"${event.name}" etkinliğinde "${teamName}" ekibinin ataması güncellendi.`,
      priority: NotificationPriority.MEDIUM,
      targetRole: NotificationTargetRole.LEADER,
      eventId: event.id,
      createdById,
      metadata: { teamName },
    });
  }

  // Yeni personel eklendiğinde
  async notifyNewStaffAdded(
    staffName: string,
    position: string,
    createdById: string
  ): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.NEW_STAFF_ADDED,
      title: "Yeni Personel Eklendi",
      message: `${staffName} (${position}) sisteme eklendi.`,
      priority: NotificationPriority.LOW,
      targetRole: NotificationTargetRole.ADMIN,
      createdById,
      metadata: { staffName, position },
    });
  }
}
