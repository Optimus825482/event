import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  StaffAssignment,
  User,
  Event,
  EventStaffAssignment,
  Staff,
} from "../../entities";
import { UserRole } from "../../entities/user.entity";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class StaffAssignmentService {
  constructor(
    @InjectRepository(StaffAssignment)
    private assignmentRepository: Repository<StaffAssignment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(EventStaffAssignment)
    private eventStaffAssignmentRepository: Repository<EventStaffAssignment>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // ==================== LEGACY ASSIGNMENT METHODS ====================

  async assignTables(
    eventId: string,
    staffId: string,
    tableIds: string[],
    color?: string,
  ): Promise<StaffAssignment> {
    const staff = await this.userRepository.findOne({ where: { id: staffId } });
    if (!staff) {
      throw new NotFoundException("Personel bulunamadı");
    }

    let assignment = await this.assignmentRepository.findOne({
      where: { eventId, staffId },
    });

    if (assignment) {
      assignment.assignedTableIds = tableIds;
      if (color) assignment.color = color;
      return this.assignmentRepository.save(assignment);
    }

    assignment = this.assignmentRepository.create({
      eventId,
      staffId,
      assignedTableIds: tableIds,
      color: color || staff.color,
    });
    return this.assignmentRepository.save(assignment);
  }

  async bulkAssignTables(
    eventId: string,
    assignments: Array<{ staffId: string; tableIds: string[] }>,
  ): Promise<StaffAssignment[]> {
    if (assignments.length === 0) {
      return [];
    }

    const staffIds = assignments.map((a) => a.staffId);

    const [existingAssignments, staffMembers] = await Promise.all([
      this.assignmentRepository.find({
        where: staffIds.map((staffId) => ({ eventId, staffId })),
      }),
      this.userRepository.find({
        where: staffIds.map((id) => ({ id })),
        select: ["id", "color"],
      }),
    ]);

    const existingMap = new Map(existingAssignments.map((a) => [a.staffId, a]));
    const colorMap = new Map(staffMembers.map((s) => [s.id, s.color]));

    const toSave: StaffAssignment[] = [];

    for (const item of assignments) {
      const existing = existingMap.get(item.staffId);
      if (existing) {
        existing.assignedTableIds = item.tableIds;
        toSave.push(existing);
      } else {
        const newAssignment = this.assignmentRepository.create({
          eventId,
          staffId: item.staffId,
          assignedTableIds: item.tableIds,
          color: colorMap.get(item.staffId) || "#3b82f6",
        });
        toSave.push(newAssignment);
      }
    }

    return this.assignmentRepository.save(toSave);
  }

  async removeAssignment(
    eventId: string,
    staffId: string,
  ): Promise<{ success: boolean }> {
    await this.assignmentRepository.delete({ eventId, staffId });
    return { success: true };
  }

  async getEventAssignments(eventId: string): Promise<any[]> {
    const assignments = await this.assignmentRepository.find({
      where: { eventId },
      relations: ["staff"],
    });

    return assignments.map((a) => ({
      id: a.id,
      eventId: a.eventId,
      staffId: a.staffId,
      staffName: a.staff?.fullName || "Bilinmeyen",
      staffColor: a.color || a.staff?.color || "#3b82f6",
      assignedTableIds: a.assignedTableIds,
      tableCount: a.assignedTableIds?.length || 0,
    }));
  }

  async getEventAssignmentSummary(eventId: string): Promise<{
    totalStaff: number;
    assignedStaff: number;
    totalTables: number;
    assignedTables: number;
    unassignedTables: number;
    avgTablesPerStaff: number;
  }> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    const totalTables = event?.venueLayout?.tables?.length || 0;

    const assignments = await this.assignmentRepository.find({
      where: { eventId },
    });
    const assignedStaff = assignments.length;

    const assignedTableIds = new Set<string>();
    assignments.forEach((a) => {
      a.assignedTableIds?.forEach((id) => assignedTableIds.add(id));
    });
    const assignedTables = assignedTableIds.size;

    const totalStaff = await this.userRepository.count({
      where: { role: UserRole.STAFF, isActive: true },
    });

    return {
      totalStaff,
      assignedStaff,
      totalTables,
      assignedTables,
      unassignedTables: totalTables - assignedTables,
      avgTablesPerStaff:
        assignedStaff > 0 ? Math.round(assignedTables / assignedStaff) : 0,
    };
  }

  async getStaffTables(eventId: string, staffId: string): Promise<string[]> {
    const assignment = await this.assignmentRepository.findOne({
      where: { eventId, staffId },
    });
    return assignment?.assignedTableIds || [];
  }

  async autoAssignTables(
    eventId: string,
    staffIds: string[],
    strategy: "balanced" | "zone" | "random" = "balanced",
  ): Promise<Array<{ staffId: string; tableIds: string[] }>> {
    if (staffIds.length === 0) {
      throw new BadRequestException("En az bir personel seçilmeli");
    }

    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event?.venueLayout?.tables) {
      throw new NotFoundException("Etkinlik veya yerleşim planı bulunamadı");
    }

    const tables = event.venueLayout.tables as Array<{
      id: string;
      type: string;
      typeName?: string;
      x: number;
      y: number;
      label: string;
    }>;
    const assignableTables = tables.filter(
      (t) => t.typeName?.toLowerCase() !== "loca" && t.type !== "loca",
    );

    if (assignableTables.length === 0) {
      return staffIds.map((id) => ({ staffId: id, tableIds: [] }));
    }

    const result: Array<{ staffId: string; tableIds: string[] }> = [];

    if (strategy === "balanced") {
      const tablesPerStaff = Math.ceil(
        assignableTables.length / staffIds.length,
      );
      let tableIndex = 0;

      for (const staffId of staffIds) {
        const tableIds: string[] = [];
        for (
          let i = 0;
          i < tablesPerStaff && tableIndex < assignableTables.length;
          i++
        ) {
          tableIds.push(assignableTables[tableIndex].id);
          tableIndex++;
        }
        result.push({ staffId, tableIds });
      }
    } else if (strategy === "zone") {
      const sortedTables = [...assignableTables].sort((a, b) => a.x - b.x);
      const zoneSize = Math.ceil(sortedTables.length / staffIds.length);

      for (let i = 0; i < staffIds.length; i++) {
        const start = i * zoneSize;
        const end = Math.min(start + zoneSize, sortedTables.length);
        const tableIds = sortedTables.slice(start, end).map((t) => t.id);
        result.push({ staffId: staffIds[i], tableIds });
      }
    } else {
      const shuffled = [...assignableTables].sort(() => Math.random() - 0.5);
      const tablesPerStaff = Math.ceil(shuffled.length / staffIds.length);
      let tableIndex = 0;

      for (const staffId of staffIds) {
        const tableIds: string[] = [];
        for (
          let i = 0;
          i < tablesPerStaff && tableIndex < shuffled.length;
          i++
        ) {
          tableIds.push(shuffled[tableIndex].id);
          tableIndex++;
        }
        result.push({ staffId, tableIds });
      }
    }

    return result;
  }

  async saveEventAssignments(
    eventId: string,
    assignments: Array<{ staffId: string; tableIds: string[]; color?: string }>,
  ): Promise<{ success: boolean; savedCount: number }> {
    await this.assignmentRepository.delete({ eventId });

    if (assignments.length === 0) {
      return { success: true, savedCount: 0 };
    }

    const staffIds = assignments.map((a) => a.staffId);
    const staffMembers = await this.userRepository.find({
      where: staffIds.map((id) => ({ id })),
      select: ["id", "color"],
    });

    const staffColorMap = new Map<string, string>();
    staffMembers.forEach((s) => staffColorMap.set(s.id, s.color));

    const assignmentEntities = assignments.map((item) =>
      this.assignmentRepository.create({
        eventId,
        staffId: item.staffId,
        assignedTableIds: item.tableIds || [],
        color: item.color || staffColorMap.get(item.staffId) || "#3b82f6",
      }),
    );

    await this.assignmentRepository.save(assignmentEntities);

    return { success: true, savedCount: assignmentEntities.length };
  }

  // ==================== EVENT STAFF ASSIGNMENT METHODS ====================

  async getStaffEventAssignments(
    staffId: string,
  ): Promise<EventStaffAssignment[]> {
    return this.eventStaffAssignmentRepository.find({
      where: { staffId, isActive: true },
      relations: ["staff", "shift", "team", "event"],
      order: { createdAt: "DESC" },
    });
  }

  async getEventStaffAssignments(
    eventId: string,
  ): Promise<EventStaffAssignment[]> {
    const assignments = await this.eventStaffAssignmentRepository.find({
      where: { eventId, isActive: true },
      order: { sortOrder: "ASC" },
    });

    const staffIds = [
      ...new Set(assignments.map((a) => a.staffId).filter(Boolean)),
    ];

    let staffMap = new Map<
      string,
      { id: string; fullName: string; position: string }
    >();

    if (staffIds.length > 0) {
      const staffMembers = await this.staffRepository
        .createQueryBuilder("staff")
        .select(["staff.id", "staff.fullName", "staff.position"])
        .where("staff.id IN (:...staffIds)", { staffIds })
        .getMany();

      staffMembers.forEach((s) => {
        staffMap.set(s.id, {
          id: s.id,
          fullName: s.fullName,
          position: s.position || "",
        });
      });

      const missingIds = staffIds.filter((id) => !staffMap.has(id));
      if (missingIds.length > 0) {
        const users = await this.userRepository
          .createQueryBuilder("user")
          .select(["user.id", "user.fullName", "user.position"])
          .where("user.id IN (:...missingIds)", { missingIds })
          .getMany();

        users.forEach((u) => {
          staffMap.set(u.id, {
            id: u.id,
            fullName: u.fullName,
            position: u.position || "",
          });
        });
      }
    }

    return assignments.map((a) => {
      const staffInfo = staffMap.get(a.staffId);
      return {
        ...a,
        staff: staffInfo || null,
        staffName: staffInfo?.fullName || "Bilinmeyen",
      } as EventStaffAssignment & { staffName: string };
    });
  }

  async assignStaffToTables(dto: {
    eventId: string;
    staffId: string;
    tableIds: string[];
    shiftId?: string;
    teamId?: string;
    color?: string;
    assignmentType?: string;
    specialTaskLocation?: string;
    specialTaskStartTime?: string;
    specialTaskEndTime?: string;
  }): Promise<EventStaffAssignment> {
    const staff = await this.staffRepository.findOne({
      where: { id: dto.staffId },
    });
    if (!staff) {
      const user = await this.userRepository.findOne({
        where: { id: dto.staffId, role: UserRole.STAFF },
      });
      if (!user) {
        throw new NotFoundException("Personel bulunamadı");
      }
    }

    if (dto.assignmentType === "special_task") {
      const assignment = this.eventStaffAssignmentRepository.create({
        eventId: dto.eventId,
        staffId: dto.staffId,
        tableIds: [],
        shiftId: dto.shiftId,
        teamId: dto.teamId,
        color: dto.color || staff?.color,
        assignmentType: "special_task",
        specialTaskLocation: dto.specialTaskLocation,
        specialTaskStartTime: dto.specialTaskStartTime,
        specialTaskEndTime: dto.specialTaskEndTime,
      });
      return this.eventStaffAssignmentRepository.save(assignment);
    }

    let assignment = await this.eventStaffAssignmentRepository.findOne({
      where: {
        eventId: dto.eventId,
        staffId: dto.staffId,
        assignmentType: "table",
        isActive: true,
      },
    });

    if (assignment) {
      assignment.tableIds = [
        ...new Set([...assignment.tableIds, ...dto.tableIds]),
      ];
      if (dto.shiftId) assignment.shiftId = dto.shiftId;
      if (dto.teamId) assignment.teamId = dto.teamId;
      if (dto.color) assignment.color = dto.color;
    } else {
      assignment = this.eventStaffAssignmentRepository.create({
        eventId: dto.eventId,
        staffId: dto.staffId,
        tableIds: dto.tableIds,
        shiftId: dto.shiftId,
        teamId: dto.teamId,
        color: dto.color || staff?.color,
        assignmentType: "table",
      });
    }

    return this.eventStaffAssignmentRepository.save(assignment);
  }

  async updateStaffAssignment(
    assignmentId: string,
    dto: {
      tableIds?: string[];
      shiftId?: string;
      teamId?: string;
      color?: string;
      notes?: string;
      assignmentType?: string;
      specialTaskLocation?: string;
      specialTaskStartTime?: string;
      specialTaskEndTime?: string;
    },
  ): Promise<EventStaffAssignment> {
    const assignment = await this.eventStaffAssignmentRepository.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException("Atama bulunamadı");
    }

    Object.assign(assignment, dto);
    return this.eventStaffAssignmentRepository.save(assignment);
  }

  async removeStaffAssignment(
    assignmentId: string,
  ): Promise<{ success: boolean }> {
    const assignment = await this.eventStaffAssignmentRepository.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException("Atama bulunamadı");
    }

    assignment.isActive = false;
    await this.eventStaffAssignmentRepository.save(assignment);
    return { success: true };
  }

  async removeStaffFromTables(
    eventId: string,
    staffId: string,
    tableIds: string[],
  ): Promise<EventStaffAssignment | null> {
    const assignment = await this.eventStaffAssignmentRepository.findOne({
      where: { eventId, staffId, isActive: true },
    });
    if (!assignment) return null;

    assignment.tableIds = assignment.tableIds.filter(
      (id) => !tableIds.includes(id),
    );

    if (assignment.tableIds.length === 0) {
      assignment.isActive = false;
    }

    return this.eventStaffAssignmentRepository.save(assignment);
  }

  async saveEventStaffAssignments(
    eventId: string,
    assignments: Array<{
      staffId: string;
      tableIds: string[];
      shiftId?: string;
      teamId?: string;
      color?: string;
    }>,
    createdById?: string,
  ): Promise<{ success: boolean; savedCount: number }> {
    try {
      await this.eventStaffAssignmentRepository.update(
        { eventId, isActive: true },
        { isActive: false },
      );

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      let savedCount = 0;
      for (const item of assignments) {
        if (item.tableIds.length === 0) continue;

        let staffColor = item.color;
        if (!staffColor) {
          const staff = await this.staffRepository.findOne({
            where: { id: item.staffId },
            select: ["id", "color"],
          });
          staffColor = staff?.color;
        }

        const validTeamId =
          item.teamId && uuidRegex.test(item.teamId) ? item.teamId : undefined;

        const assignment = this.eventStaffAssignmentRepository.create({
          eventId,
          staffId: item.staffId,
          tableIds: item.tableIds,
          shiftId: item.shiftId,
          teamId: validTeamId,
          color: staffColor,
          isActive: true,
        });
        await this.eventStaffAssignmentRepository.save(assignment);
        savedCount++;
      }

      if (savedCount > 0 && createdById) {
        try {
          const event = await this.eventRepository.findOne({
            where: { id: eventId },
          });
          if (event) {
            await this.notificationsService.notifyTeamOrganizationCompleted(
              event,
              createdById,
            );
          }
        } catch {
          // Bildirim hatası ana işlemi etkilemesin
        }
      }

      return { success: true, savedCount };
    } catch (error) {
      console.error("❌ saveEventStaffAssignments error:", error);
      throw error;
    }
  }
}
