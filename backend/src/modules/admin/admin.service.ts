import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import { User, UserRole } from "../../entities/user.entity";
import { Event } from "../../entities/event.entity";
import { Team } from "../../entities/team.entity";
import { StaffPerformanceReview } from "../../entities/staff-performance-review.entity";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(StaffPerformanceReview)
    private reviewRepository: Repository<StaffPerformanceReview>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // Kullanıcı istatistikleri
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });
    const adminCount = await this.userRepository.count({
      where: { role: UserRole.ADMIN },
    });
    const leaderCount = await this.userRepository.count({
      where: { role: UserRole.LEADER },
    });
    const staffCount = await this.userRepository.count({
      where: { role: UserRole.STAFF },
    });

    const newUsersThisMonth = await this.userRepository.count({
      where: { createdAt: MoreThanOrEqual(startOfMonth) },
    });

    // Etkinlik istatistikleri
    const totalEvents = await this.eventRepository.count();
    const eventsThisMonth = await this.eventRepository.count({
      where: { createdAt: MoreThanOrEqual(startOfMonth) },
    });
    const eventsToday = await this.eventRepository.count({
      where: { createdAt: MoreThanOrEqual(startOfDay) },
    });
    const upcomingEvents = await this.eventRepository.count({
      where: { eventDate: MoreThanOrEqual(now) },
    });

    // Takım istatistikleri
    const totalTeams = await this.teamRepository.count();
    const activeTeams = await this.teamRepository.count({
      where: { isActive: true },
    });

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminCount,
        leaders: leaderCount,
        staff: staffCount,
        newThisMonth: newUsersThisMonth,
      },
      events: {
        total: totalEvents,
        thisMonth: eventsThisMonth,
        today: eventsToday,
        upcoming: upcomingEvents,
      },
      teams: {
        total: totalTeams,
        active: activeTeams,
      },
      system: {
        uptime: "99.9%",
        version: "1.0.0",
        lastBackup: new Date().toISOString(),
      },
    };
  }

  // Etkinlik review ayarlarını getir
  async getEventReviewSettings(eventId: string) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ["id", "name", "reviewEnabled", "reviewHistoryVisible"],
    });

    if (!event) {
      throw new NotFoundException("Etkinlik bulunamadı");
    }

    // Bu etkinlik için yapılan değerlendirme sayısı
    const reviewCount = await this.reviewRepository.count({
      where: { eventId },
    });

    return {
      ...event,
      reviewCount,
    };
  }

  // Etkinlik review ayarlarını güncelle
  async updateEventReviewSettings(
    eventId: string,
    settings: { reviewEnabled?: boolean; reviewHistoryVisible?: boolean },
    updatedById?: string
  ) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException("Etkinlik bulunamadı");
    }

    const wasReviewEnabled = event.reviewEnabled;

    if (settings.reviewEnabled !== undefined) {
      event.reviewEnabled = settings.reviewEnabled;
    }
    if (settings.reviewHistoryVisible !== undefined) {
      event.reviewHistoryVisible = settings.reviewHistoryVisible;
    }

    await this.eventRepository.save(event);

    // Bildirim gönder: Review sistemi aktive/deaktive edildi
    if (
      settings.reviewEnabled !== undefined &&
      settings.reviewEnabled !== wasReviewEnabled
    ) {
      try {
        if (settings.reviewEnabled) {
          await this.notificationsService.notifyReviewSystemActivated(
            event,
            updatedById || ""
          );
        } else {
          await this.notificationsService.notifyReviewSystemDeactivated(
            event,
            updatedById || ""
          );
        }
      } catch (error) {
        console.error("[ADMIN] Notification error:", error);
        // Bildirim hatası ana işlemi etkilemesin
      }
    }

    return {
      message: "Ayarlar güncellendi",
      reviewEnabled: event.reviewEnabled,
      reviewHistoryVisible: event.reviewHistoryVisible,
    };
  }

  // Tüm etkinliklerin review ayarlarını listele
  async getAllEventsReviewSettings() {
    const events = await this.eventRepository.find({
      select: [
        "id",
        "name",
        "eventDate",
        "status",
        "reviewEnabled",
        "reviewHistoryVisible",
      ],
      order: { eventDate: "DESC" },
    });

    // Her etkinlik için değerlendirme sayısını al
    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const reviewCount = await this.reviewRepository.count({
          where: { eventId: event.id },
        });
        const completedReviewCount = await this.reviewRepository.count({
          where: { eventId: event.id, isCompleted: true },
        });
        return {
          ...event,
          reviewCount,
          completedReviewCount,
        };
      })
    );

    return eventsWithCounts;
  }

  // Toplu review ayarı güncelleme
  async bulkUpdateReviewSettings(
    eventIds: string[],
    settings: { reviewEnabled?: boolean; reviewHistoryVisible?: boolean }
  ) {
    await this.eventRepository
      .createQueryBuilder()
      .update(Event)
      .set(settings)
      .whereInIds(eventIds)
      .execute();

    return {
      message: `${eventIds.length} etkinlik güncellendi`,
      updatedCount: eventIds.length,
    };
  }
}
