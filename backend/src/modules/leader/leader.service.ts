import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual, In } from "typeorm";
import { User, UserRole } from "../../entities/user.entity";
import { Event, EventStatus } from "../../entities/event.entity";
import { Team } from "../../entities/team.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";
import {
  StaffPerformanceReview,
  PerformanceRating,
  CategoryScores,
} from "../../entities/staff-performance-review.entity";
import { TableGroup } from "../../entities/table-group.entity";
import { NotificationsService } from "../notifications/notifications.service";

// Kategori bazlı puanlardan genel puan hesaplama
function calculateOverallScore(categoryScores: CategoryScores): number {
  const weights = {
    communication: 15,
    punctuality: 15,
    teamwork: 15,
    customerService: 20,
    technicalSkills: 10,
    initiative: 10,
    appearance: 5,
    stressManagement: 10,
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const score = categoryScores[key as keyof CategoryScores];
    if (score !== undefined && score !== null) {
      totalScore += (score / 5) * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
}

// Puandan rating hesaplama
function getRatingFromScore(score: number): PerformanceRating {
  if (score >= 90) return PerformanceRating.EXCELLENT;
  if (score >= 80) return PerformanceRating.SUCCESSFUL;
  if (score >= 60) return PerformanceRating.GOOD;
  if (score >= 40) return PerformanceRating.AVERAGE;
  if (score >= 20) return PerformanceRating.BAD;
  return PerformanceRating.VERY_BAD;
}

@Injectable()
export class LeaderService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(EventStaffAssignment)
    private assignmentRepository: Repository<EventStaffAssignment>,
    @InjectRepository(StaffPerformanceReview)
    private reviewRepository: Repository<StaffPerformanceReview>,
    @InjectRepository(TableGroup)
    private tableGroupRepository: Repository<TableGroup>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

  async getDashboard(leaderId: string) {
    const leader = await this.userRepository.findOne({
      where: { id: leaderId },
    });
    if (!leader || leader.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    const teams = await this.teamRepository.find({
      where: { leaderId, isActive: true },
    });

    const upcomingEvents = await this.eventRepository.find({
      where: {
        status: In([EventStatus.PUBLISHED, EventStatus.ACTIVE]),
        eventDate: MoreThanOrEqual(new Date()),
      },
      order: { eventDate: "ASC" },
      take: 5,
    });

    // Leader'ın direkt atamaları
    const directAssignments = await this.assignmentRepository.find({
      where: { staffId: leaderId, isActive: true },
      relations: ["event", "team"],
    });

    // Leader'ın takımlarının atandığı etkinlikler
    const teamIds = teams.map((t) => t.id);
    const teamAssignments =
      teamIds.length > 0
        ? await this.assignmentRepository.find({
            where: { teamId: In(teamIds), isActive: true },
            relations: ["event", "team"],
          })
        : [];

    // Tüm atamaları birleştir ve unique eventId'leri al
    const allAssignments = [...directAssignments, ...teamAssignments];
    const assignedEventIds = [...new Set(allAssignments.map((a) => a.eventId))];

    const assignedEvents =
      assignedEventIds.length > 0
        ? await this.eventRepository.find({
            where: { id: In(assignedEventIds) },
            order: { eventDate: "ASC" },
          })
        : [];

    const pastEvents = await this.eventRepository.find({
      where: { status: EventStatus.COMPLETED },
      order: { eventDate: "DESC" },
      take: 10,
    });

    const teamsWithMembers = await Promise.all(
      teams.map(async (team) => {
        // Takım üyelerini event_staff_assignments'tan al (teamId'ye göre)
        // Önce bu takıma atanmış tüm personelleri bul
        const teamAssignmentsForMembers = await this.assignmentRepository.find({
          where: { teamId: team.id, isActive: true },
          relations: ["staff"],
        });

        // Unique personelleri al (aynı personel birden fazla masaya atanmış olabilir)
        const uniqueStaffIds = [
          ...new Set(teamAssignmentsForMembers.map((a) => a.staffId)),
        ];

        // Leader hariç üyeleri al
        const members = uniqueStaffIds
          .filter((staffId) => staffId !== leaderId)
          .map((staffId) => {
            const assignment = teamAssignmentsForMembers.find(
              (a) => a.staffId === staffId
            );
            return {
              id: assignment?.staff?.id || staffId,
              fullName: assignment?.staff?.fullName || "Bilinmeyen",
              avatar: assignment?.staff?.avatar,
              color: assignment?.color || assignment?.staff?.color,
              position: assignment?.staff?.position,
            };
          });

        return { ...team, members, memberCount: members.length };
      })
    );

    return {
      leader: {
        id: leader.id,
        fullName: leader.fullName,
        avatar: leader.avatar,
        position: leader.position,
      },
      teams: teamsWithMembers,
      upcomingEvents: upcomingEvents.map((e) => ({ ...e, date: e.eventDate })),
      assignedEvents: assignedEvents.map((e) => ({ ...e, date: e.eventDate })),
      pastEventsForReview: pastEvents.map((e) => ({ ...e, date: e.eventDate })),
      stats: {
        totalTeams: teams.length,
        totalMembers: teamsWithMembers.reduce(
          (sum, t) => sum + (t.memberCount || 0),
          0
        ),
        upcomingEventsCount: upcomingEvents.length,
        assignedEventsCount: assignedEvents.length,
      },
    };
  }

  async getEventDetails(leaderId: string, eventId: string) {
    const leader = await this.userRepository.findOne({
      where: { id: leaderId },
    });
    if (!leader || leader.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException("Etkinlik bulunamadı");
    }

    const leaderAssignment = await this.assignmentRepository.findOne({
      where: { eventId, staffId: leaderId, isActive: true },
      relations: ["team"],
    });

    if (!leaderAssignment?.teamId) {
      return {
        event: { ...event, date: event.eventDate },
        team: null,
        members: [],
        tableGroups: [],
        totalGuests: 0,
      };
    }

    const team = await this.teamRepository.findOne({
      where: { id: leaderAssignment.teamId },
    });

    if (!team) {
      return {
        event: { ...event, date: event.eventDate },
        team: null,
        members: [],
        tableGroups: [],
        totalGuests: 0,
      };
    }

    // Vardiya bilgisi dahil
    const memberAssignments = await this.assignmentRepository.find({
      where: { eventId, teamId: team.id, isActive: true },
      relations: ["staff", "shift"],
    });

    // Personellerin atandığı masa ID'leri
    const allTableIds = memberAssignments.flatMap((a) => a.tableIds || []);
    const uniqueTableIds = [...new Set(allTableIds)];

    // Bu takıma atanmış masa gruplarını bul (assignedTeamId'ye göre)
    const tableGroups = await this.tableGroupRepository.find({
      where: { eventId, assignedTeamId: team.id },
    });

    // Masa ID -> Masa Grubu eşleştirmesi
    const tableIdToGroupMap = new Map<
      string,
      { id: string; name: string; color: string }
    >();
    tableGroups.forEach((group) => {
      (group.tableIds || []).forEach((tableId) => {
        tableIdToGroupMap.set(tableId, {
          id: group.id,
          name: group.name,
          color: group.color,
        });
      });
    });

    let totalGuests = 0;
    const venueLayout = event.venueLayout as any;
    if (venueLayout?.placedTables || venueLayout?.tables) {
      const placedTables = venueLayout.placedTables || venueLayout.tables || [];
      uniqueTableIds.forEach((tableId) => {
        const table = placedTables.find((t: any) => t.id === tableId);
        if (table) totalGuests += table.capacity || table.seats || 0;
      });
    }

    // Mevcut değerlendirmeleri al
    const existingReviews = await this.reviewRepository.find({
      where: { eventId, reviewerId: leaderId },
    });
    const reviewMap = new Map(existingReviews.map((r) => [r.staffId, r]));

    const members = memberAssignments
      .filter((a) => a.staffId !== leaderId) // Leader'ı listeden çıkar
      .map((a) => {
        // Personelin atandığı masa gruplarını bul
        const assignedGroups = new Map<
          string,
          { id: string; name: string; color: string }
        >();
        (a.tableIds || []).forEach((tableId) => {
          const group = tableIdToGroupMap.get(tableId);
          if (group && !assignedGroups.has(group.id)) {
            assignedGroups.set(group.id, group);
          }
        });

        return {
          id: a.staff.id,
          fullName: a.staff.fullName,
          avatar: a.staff.avatar,
          color: a.color || a.staff.color,
          position: a.staff.position,
          tableIds: a.tableIds,
          assignmentType: a.assignmentType,
          specialTaskLocation: a.specialTaskLocation,
          // Vardiya bilgisi
          shift: a.shift
            ? {
                id: a.shift.id,
                name: a.shift.name,
                startTime: a.shift.startTime,
                endTime: a.shift.endTime,
              }
            : null,
          // Özel görev saatleri
          specialTaskStartTime: a.specialTaskStartTime,
          specialTaskEndTime: a.specialTaskEndTime,
          // Atanan masa grupları
          tableGroups: Array.from(assignedGroups.values()),
          // Mevcut değerlendirme
          existingReview: reviewMap.get(a.staffId) || null,
        };
      });

    return {
      event: { ...event, date: event.eventDate },
      team,
      members,
      tableGroups,
      totalGuests,
      venueLayout: event.venueLayout,
    };
  }

  async createReview(
    reviewerId: string,
    dto: {
      staffId: string;
      eventId: string;
      score?: number;
      rating?: PerformanceRating;
      comment?: string;
      categoryScores?: CategoryScores;
      strengths?: string[];
      improvements?: string[];
      privateNotes?: string;
      recommendedTrainings?: string[];
      nextEventNotes?: string;
      isCompleted?: boolean;
    }
  ) {
    const reviewer = await this.userRepository.findOne({
      where: { id: reviewerId },
    });
    if (!reviewer || reviewer.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    // Kategori puanlarından genel puan hesapla
    let score = dto.score || 0;
    let rating = dto.rating || PerformanceRating.AVERAGE;

    if (dto.categoryScores) {
      score = calculateOverallScore(dto.categoryScores);
      rating = getRatingFromScore(score);
    }

    const existing = await this.reviewRepository.findOne({
      where: { staffId: dto.staffId, eventId: dto.eventId, reviewerId },
    });

    if (existing) {
      existing.score = score;
      existing.rating = rating;
      if (dto.comment !== undefined) existing.comment = dto.comment;
      if (dto.categoryScores) existing.categoryScores = dto.categoryScores;
      if (dto.strengths) existing.strengths = dto.strengths;
      if (dto.improvements) existing.improvements = dto.improvements;
      if (dto.privateNotes !== undefined)
        existing.privateNotes = dto.privateNotes;
      if (dto.recommendedTrainings)
        existing.recommendedTrainings = dto.recommendedTrainings;
      if (dto.nextEventNotes !== undefined)
        existing.nextEventNotes = dto.nextEventNotes;
      if (dto.isCompleted !== undefined) existing.isCompleted = dto.isCompleted;
      return this.reviewRepository.save(existing);
    }

    const review = this.reviewRepository.create({
      staffId: dto.staffId,
      eventId: dto.eventId,
      reviewerId,
      score,
      rating,
      comment: dto.comment,
      categoryScores: dto.categoryScores,
      strengths: dto.strengths || [],
      improvements: dto.improvements || [],
      privateNotes: dto.privateNotes,
      recommendedTrainings: dto.recommendedTrainings || [],
      nextEventNotes: dto.nextEventNotes,
      isCompleted: dto.isCompleted || false,
    });
    return this.reviewRepository.save(review);
  }

  async createBulkReviews(
    reviewerId: string,
    eventId: string,
    reviews: Array<{
      staffId: string;
      score?: number;
      rating?: PerformanceRating;
      comment?: string;
      categoryScores?: CategoryScores;
      strengths?: string[];
      improvements?: string[];
      privateNotes?: string;
      recommendedTrainings?: string[];
      nextEventNotes?: string;
      isCompleted?: boolean;
    }>
  ) {
    return Promise.all(
      reviews.map((r) => this.createReview(reviewerId, { ...r, eventId }))
    );
  }

  // Personel performans analizi
  async getStaffPerformanceAnalysis(staffId: string) {
    const reviews = await this.reviewRepository.find({
      where: { staffId },
      relations: ["event", "reviewer"],
      order: { createdAt: "DESC" },
    });

    if (reviews.length === 0) {
      return {
        staffId,
        totalReviews: 0,
        averageScore: 0,
        averageRating: null,
        categoryAverages: null,
        trend: "stable",
        recentReviews: [],
        strengths: [],
        improvements: [],
      };
    }

    // Ortalama puan
    const averageScore = Math.round(
      reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length
    );

    // Kategori ortalamaları
    const categoryTotals: Record<string, { sum: number; count: number }> = {};
    reviews.forEach((r) => {
      if (r.categoryScores) {
        Object.entries(r.categoryScores).forEach(([key, value]) => {
          if (!categoryTotals[key]) {
            categoryTotals[key] = { sum: 0, count: 0 };
          }
          categoryTotals[key].sum += value;
          categoryTotals[key].count += 1;
        });
      }
    });

    const categoryAverages: Record<string, number> = {};
    Object.entries(categoryTotals).forEach(([key, { sum, count }]) => {
      categoryAverages[key] = Math.round((sum / count) * 10) / 10;
    });

    // Trend analizi (son 3 vs önceki 3)
    let trend: "improving" | "declining" | "stable" = "stable";
    if (reviews.length >= 4) {
      const recent = reviews.slice(0, 3);
      const older = reviews.slice(3, 6);
      const recentAvg = recent.reduce((s, r) => s + r.score, 0) / recent.length;
      const olderAvg = older.reduce((s, r) => s + r.score, 0) / older.length;
      if (recentAvg > olderAvg + 5) trend = "improving";
      else if (recentAvg < olderAvg - 5) trend = "declining";
    }

    // En sık güçlü yönler ve gelişim alanları
    const strengthCounts: Record<string, number> = {};
    const improvementCounts: Record<string, number> = {};
    reviews.forEach((r) => {
      (r.strengths || []).forEach((s) => {
        strengthCounts[s] = (strengthCounts[s] || 0) + 1;
      });
      (r.improvements || []).forEach((i) => {
        improvementCounts[i] = (improvementCounts[i] || 0) + 1;
      });
    });

    const topStrengths = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const topImprovements = Object.entries(improvementCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      staffId,
      totalReviews: reviews.length,
      averageScore,
      averageRating: getRatingFromScore(averageScore),
      categoryAverages,
      trend,
      recentReviews: reviews.slice(0, 5).map((r) => ({
        id: r.id,
        eventId: r.eventId,
        eventName: r.event?.name,
        eventDate: r.event?.eventDate,
        score: r.score,
        rating: r.rating,
        reviewerName: r.reviewer?.fullName,
        createdAt: r.createdAt,
      })),
      strengths: topStrengths,
      improvements: topImprovements,
    };
  }

  // Etkinlik performans özeti
  async getEventPerformanceSummary(reviewerId: string, eventId: string) {
    const reviews = await this.reviewRepository.find({
      where: { eventId, reviewerId },
      relations: ["staff"],
    });

    if (reviews.length === 0) {
      return {
        eventId,
        totalReviewed: 0,
        averageScore: 0,
        ratingDistribution: {},
        topPerformers: [],
        needsImprovement: [],
      };
    }

    const averageScore = Math.round(
      reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length
    );

    // Rating dağılımı
    const ratingDistribution: Record<string, number> = {};
    reviews.forEach((r) => {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    });

    // En iyi performans gösterenler
    const sortedByScore = [...reviews].sort((a, b) => b.score - a.score);
    const topPerformers = sortedByScore.slice(0, 3).map((r) => ({
      staffId: r.staffId,
      staffName: r.staff?.fullName,
      score: r.score,
      rating: r.rating,
    }));

    // Gelişim gerektiren personel
    const needsImprovement = sortedByScore
      .filter((r) => r.score < 60)
      .map((r) => ({
        staffId: r.staffId,
        staffName: r.staff?.fullName,
        score: r.score,
        rating: r.rating,
        improvements: r.improvements,
      }));

    return {
      eventId,
      totalReviewed: reviews.length,
      averageScore,
      ratingDistribution,
      topPerformers,
      needsImprovement,
    };
  }

  async getEventReviews(reviewerId: string, eventId: string) {
    return this.reviewRepository.find({
      where: { eventId, reviewerId },
      relations: ["staff"],
    });
  }

  async getStaffReviews(staffId: string) {
    return this.reviewRepository.find({
      where: { staffId },
      relations: ["event", "reviewer"],
      order: { createdAt: "DESC" },
    });
  }

  async getTeamMembersForReview(leaderId: string, eventId: string) {
    const leader = await this.userRepository.findOne({
      where: { id: leaderId },
    });
    if (!leader || leader.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    // Etkinlik review izni kontrolü
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException("Etkinlik bulunamadı");
    }

    const leaderAssignment = await this.assignmentRepository.findOne({
      where: { eventId, staffId: leaderId, isActive: true },
    });

    if (!leaderAssignment?.teamId) return [];

    const memberAssignments = await this.assignmentRepository.find({
      where: { eventId, teamId: leaderAssignment.teamId, isActive: true },
      relations: ["staff"],
    });

    const existingReviews = await this.reviewRepository.find({
      where: { eventId, reviewerId: leaderId },
    });

    const reviewMap = new Map(existingReviews.map((r) => [r.staffId, r]));

    return memberAssignments
      .filter((a) => a.staffId !== leaderId)
      .map((a) => ({
        id: a.staff.id,
        fullName: a.staff.fullName,
        avatar: a.staff.avatar,
        position: a.staff.position,
        existingReview: reviewMap.get(a.staffId) || null,
      }));
  }

  // Etkinlik review ayarlarını kontrol et
  async getEventReviewPermissions(leaderId: string, eventId: string) {
    const leader = await this.userRepository.findOne({
      where: { id: leaderId },
    });
    if (!leader || leader.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ["id", "name", "reviewEnabled", "reviewHistoryVisible", "status"],
    });

    if (!event) {
      throw new NotFoundException("Etkinlik bulunamadı");
    }

    return {
      eventId: event.id,
      eventName: event.name,
      eventStatus: event.status,
      reviewEnabled: event.reviewEnabled ?? false,
      reviewHistoryVisible: event.reviewHistoryVisible ?? false,
    };
  }

  // Auto-save: Tek bir personel için anlık kaydetme
  async autoSaveReview(
    reviewerId: string,
    dto: {
      staffId: string;
      eventId: string;
      categoryScores?: CategoryScores;
      strengths?: string[];
      improvements?: string[];
      comment?: string;
      privateNotes?: string;
      nextEventNotes?: string;
    }
  ) {
    const reviewer = await this.userRepository.findOne({
      where: { id: reviewerId },
    });
    if (!reviewer || reviewer.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    // Etkinlik review izni kontrolü
    const event = await this.eventRepository.findOne({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException("Etkinlik bulunamadı");
    }
    if (!event.reviewEnabled) {
      throw new ForbiddenException(
        "Bu etkinlik için değerlendirme sistemi kapalı"
      );
    }

    // Kategori puanlarından genel puan hesapla
    let score = 0;
    let rating = PerformanceRating.AVERAGE;

    if (dto.categoryScores) {
      score = calculateOverallScore(dto.categoryScores);
      rating = getRatingFromScore(score);
    }

    const existing = await this.reviewRepository.findOne({
      where: { staffId: dto.staffId, eventId: dto.eventId, reviewerId },
    });

    if (existing) {
      // Mevcut kaydı güncelle
      if (dto.categoryScores) {
        existing.categoryScores = dto.categoryScores;
        existing.score = score;
        existing.rating = rating;
      }
      if (dto.strengths !== undefined) existing.strengths = dto.strengths;
      if (dto.improvements !== undefined)
        existing.improvements = dto.improvements;
      if (dto.comment !== undefined) existing.comment = dto.comment;
      if (dto.privateNotes !== undefined)
        existing.privateNotes = dto.privateNotes;
      if (dto.nextEventNotes !== undefined)
        existing.nextEventNotes = dto.nextEventNotes;

      const saved = await this.reviewRepository.save(existing);
      return {
        success: true,
        reviewId: saved.id,
        score: saved.score,
        rating: saved.rating,
        updatedAt: saved.updatedAt,
      };
    }

    // Yeni kayıt oluştur
    const review = this.reviewRepository.create({
      staffId: dto.staffId,
      eventId: dto.eventId,
      reviewerId,
      score,
      rating,
      categoryScores: dto.categoryScores,
      strengths: dto.strengths || [],
      improvements: dto.improvements || [],
      comment: dto.comment,
      privateNotes: dto.privateNotes,
      nextEventNotes: dto.nextEventNotes,
      isCompleted: false,
    });

    const saved = await this.reviewRepository.save(review);
    return {
      success: true,
      reviewId: saved.id,
      score: saved.score,
      rating: saved.rating,
      updatedAt: saved.updatedAt,
    };
  }

  // Değerlendirmeyi tamamla (final submit)
  async completeReview(reviewerId: string, eventId: string, staffId: string) {
    const reviewer = await this.userRepository.findOne({
      where: { id: reviewerId },
    });
    if (!reviewer || reviewer.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    const review = await this.reviewRepository.findOne({
      where: { staffId, eventId, reviewerId },
      relations: ["staff", "event"],
    });

    if (!review) {
      throw new NotFoundException("Değerlendirme bulunamadı");
    }

    review.isCompleted = true;
    await this.reviewRepository.save(review);

    // Bildirim gönder: Personel değerlendirmesi tamamlandı
    try {
      if (review.event && review.staff) {
        await this.notificationsService.notifyStaffReviewCompleted(
          review.event,
          review.staff.fullName,
          reviewer.fullName,
          reviewerId
        );
      }
    } catch {
      // Bildirim hatası ana işlemi etkilemesin
    }

    return {
      success: true,
      message: "Değerlendirme tamamlandı",
      reviewId: review.id,
    };
  }

  // Tüm değerlendirmeleri tamamla
  async completeAllReviews(reviewerId: string, eventId: string) {
    const reviewer = await this.userRepository.findOne({
      where: { id: reviewerId },
    });
    if (!reviewer || reviewer.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    // Önce etkinlik bilgisini al
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    const result = await this.reviewRepository.update(
      { eventId, reviewerId },
      { isCompleted: true }
    );

    // Bildirim gönder: Toplu değerlendirme tamamlandı
    try {
      if (event && result.affected && result.affected > 0) {
        await this.notificationsService.createNotification({
          type: "staff_review_completed" as any,
          title: "Toplu Değerlendirme Tamamlandı",
          message: `"${event.name}" etkinliğinde ${reviewer.fullName} tarafından ${result.affected} personel değerlendirildi.`,
          priority: "low" as any,
          targetRole: "admin" as any,
          eventId: event.id,
          createdById: reviewerId,
          metadata: {
            reviewerName: reviewer.fullName,
            reviewCount: result.affected,
          },
        });
      }
    } catch {
      // Bildirim hatası ana işlemi etkilemesin
    }

    return {
      success: true,
      message: `${result.affected} değerlendirme tamamlandı`,
      updatedCount: result.affected,
    };
  }

  // Tüm personellerin değerlendirme özetleri - Optimize edilmiş versiyon
  async getAllStaffReviewsSummary() {
    // Staff ve Leader rolündeki tüm kullanıcıları al
    const staffUsers = await this.userRepository.find({
      where: [{ role: UserRole.STAFF }, { role: UserRole.LEADER }],
      select: ["id", "fullName", "avatar", "position", "color", "role"],
      order: { position: "ASC", fullName: "ASC" },
    });

    if (staffUsers.length === 0) return [];

    const staffIds = staffUsers.map((s) => s.id);

    // Tüm değerlendirmeleri tek sorguda al
    const allReviews = await this.reviewRepository
      .createQueryBuilder("review")
      .select(["review.staffId", "review.score"])
      .where("review.staffId IN (:...staffIds)", { staffIds })
      .getMany();

    // Tüm atamaları tek sorguda al
    const allAssignments = await this.assignmentRepository
      .createQueryBuilder("assignment")
      .select(["assignment.staffId", "assignment.eventId"])
      .where("assignment.staffId IN (:...staffIds)", { staffIds })
      .andWhere("assignment.isActive = :isActive", { isActive: true })
      .getMany();

    // Personel bazlı grupla
    const reviewsByStaff = new Map<string, { scores: number[] }>();
    const eventsByStaff = new Map<string, Set<string>>();

    allReviews.forEach((r) => {
      if (!reviewsByStaff.has(r.staffId)) {
        reviewsByStaff.set(r.staffId, { scores: [] });
      }
      reviewsByStaff.get(r.staffId)!.scores.push(r.score);
    });

    allAssignments.forEach((a) => {
      if (!eventsByStaff.has(a.staffId)) {
        eventsByStaff.set(a.staffId, new Set());
      }
      eventsByStaff.get(a.staffId)!.add(a.eventId);
    });

    // Sonuçları oluştur
    return staffUsers.map((staff) => {
      const reviewData = reviewsByStaff.get(staff.id);
      const eventSet = eventsByStaff.get(staff.id);

      const totalReviews = reviewData?.scores.length || 0;
      const averageScore =
        totalReviews > 0
          ? Math.round(
              reviewData!.scores.reduce((sum, s) => sum + s, 0) / totalReviews
            )
          : 0;

      return {
        id: staff.id,
        fullName: staff.fullName,
        avatar: staff.avatar,
        position: staff.position,
        color: staff.color,
        totalReviews,
        averageScore,
        averageRating:
          totalReviews > 0 ? getRatingFromScore(averageScore) : null,
        totalEvents: eventSet?.size || 0,
      };
    });
  }

  // Personelin atandığı etkinlikler ve değerlendirmeleri
  async getStaffEventReviews(staffId: string) {
    // Personelin atandığı tüm etkinlikleri bul
    const assignments = await this.assignmentRepository.find({
      where: { staffId, isActive: true },
      relations: ["event"],
    });

    // Unique etkinlikleri al
    const eventMap = new Map<string, any>();
    assignments.forEach((a) => {
      if (a.event && !eventMap.has(a.eventId)) {
        eventMap.set(a.eventId, a.event);
      }
    });

    // Her etkinlik için değerlendirmeyi bul
    const eventReviews = await Promise.all(
      Array.from(eventMap.entries()).map(async ([eventId, event]) => {
        const review = await this.reviewRepository.findOne({
          where: { staffId, eventId },
          relations: ["reviewer"],
        });

        return {
          eventId,
          eventName: event.name,
          eventDate: event.eventDate,
          eventStatus: event.status,
          hasReview: !!review,
          review: review
            ? {
                id: review.id,
                score: review.score,
                rating: review.rating,
                categoryScores: review.categoryScores,
                strengths: review.strengths,
                improvements: review.improvements,
                comment: review.comment,
                reviewerName: review.reviewer?.fullName,
                createdAt: review.createdAt,
              }
            : null,
        };
      })
    );

    // Tarihe göre sırala (en yeni önce)
    eventReviews.sort((a, b) => {
      const dateA = new Date(a.eventDate).getTime();
      const dateB = new Date(b.eventDate).getTime();
      return dateB - dateA;
    });

    return eventReviews;
  }
}
