import {
  Injectable,
  NotFoundException,
  ForbiddenException,
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
} from "../../entities/staff-performance-review.entity";
import { TableGroup } from "../../entities/table-group.entity";

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
    private tableGroupRepository: Repository<TableGroup>
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
      score: number;
      rating: PerformanceRating;
      comment?: string;
    }
  ) {
    const reviewer = await this.userRepository.findOne({
      where: { id: reviewerId },
    });
    if (!reviewer || reviewer.role !== UserRole.LEADER) {
      throw new ForbiddenException("Bu işlem için lider yetkisi gerekli");
    }

    const existing = await this.reviewRepository.findOne({
      where: { staffId: dto.staffId, eventId: dto.eventId, reviewerId },
    });

    if (existing) {
      existing.score = dto.score;
      existing.rating = dto.rating;
      if (dto.comment !== undefined) existing.comment = dto.comment;
      return this.reviewRepository.save(existing);
    }

    const review = this.reviewRepository.create({ ...dto, reviewerId });
    return this.reviewRepository.save(review);
  }

  async createBulkReviews(
    reviewerId: string,
    eventId: string,
    reviews: Array<{
      staffId: string;
      score: number;
      rating: PerformanceRating;
      comment?: string;
    }>
  ) {
    return Promise.all(
      reviews.map((r) => this.createReview(reviewerId, { ...r, eventId }))
    );
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
}
