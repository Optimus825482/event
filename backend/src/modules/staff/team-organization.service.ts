import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  User,
  Event,
  ServiceTeam,
  TableGroup,
  Team,
  EventStaffAssignment,
  OrganizationTemplate,
  Staff,
} from "../../entities";
import { UserRole } from "../../entities/user.entity";
import { TeamMember } from "../../entities/service-team.entity";

@Injectable()
export class TeamOrganizationService {
  constructor(
    @InjectRepository(ServiceTeam)
    private serviceTeamRepository: Repository<ServiceTeam>,
    @InjectRepository(TableGroup)
    private tableGroupRepository: Repository<TableGroup>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(EventStaffAssignment)
    private eventStaffAssignmentRepository: Repository<EventStaffAssignment>,
    @InjectRepository(OrganizationTemplate)
    private organizationTemplateRepository: Repository<OrganizationTemplate>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private dataSource: DataSource,
  ) {}

  // ==================== SERVICE TEAM METHODS (EVENT-BASED) ====================

  async getEventTeams(eventId: string): Promise<ServiceTeam[]> {
    return this.serviceTeamRepository.find({
      where: { eventId },
      order: { createdAt: "ASC" },
    });
  }

  async getServiceTeamById(teamId: string): Promise<ServiceTeam> {
    const team = await this.serviceTeamRepository.findOne({
      where: { id: teamId },
    });
    if (!team) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return team;
  }

  async createServiceTeam(dto: {
    eventId: string;
    name: string;
    color: string;
    members?: TeamMember[];
    leaderId?: string;
    tableIds?: string[];
  }): Promise<ServiceTeam> {
    const team = this.serviceTeamRepository.create({
      eventId: dto.eventId,
      name: dto.name,
      color: dto.color,
      members: dto.members || [],
      leaderId: dto.leaderId,
      tableIds: dto.tableIds || [],
    });
    return this.serviceTeamRepository.save(team);
  }

  async updateServiceTeam(
    teamId: string,
    dto: {
      name?: string;
      color?: string;
      members?: TeamMember[];
      leaderId?: string;
      tableIds?: string[];
    },
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);
    Object.assign(team, dto);
    return this.serviceTeamRepository.save(team);
  }

  async deleteServiceTeam(teamId: string): Promise<{ success: boolean }> {
    const result = await this.serviceTeamRepository.delete(teamId);
    if (result.affected === 0) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return { success: true };
  }

  async addMemberToServiceTeam(
    teamId: string,
    member: TeamMember,
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);

    if (team.members.some((m) => m.id === member.id)) {
      throw new BadRequestException("Bu personel zaten ekipte");
    }

    team.members.push(member);
    return this.serviceTeamRepository.save(team);
  }

  async removeMemberFromServiceTeam(
    teamId: string,
    memberId: string,
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);
    team.members = team.members.filter((m) => m.id !== memberId);

    if (team.leaderId === memberId) {
      team.leaderId = undefined;
    }

    return this.serviceTeamRepository.save(team);
  }

  async assignTablesToServiceTeam(
    teamId: string,
    tableIds: string[],
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);

    const otherTeams = await this.serviceTeamRepository.find({
      where: { eventId: team.eventId },
    });

    for (const otherTeam of otherTeams) {
      if (otherTeam.id !== teamId) {
        const filteredTableIds = otherTeam.tableIds.filter(
          (id) => !tableIds.includes(id),
        );
        if (filteredTableIds.length !== otherTeam.tableIds.length) {
          otherTeam.tableIds = filteredTableIds;
          await this.serviceTeamRepository.save(otherTeam);
        }
      }
    }

    team.tableIds = [...new Set([...team.tableIds, ...tableIds])];
    return this.serviceTeamRepository.save(team);
  }

  async removeTablesFromServiceTeam(
    teamId: string,
    tableIds: string[],
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);
    team.tableIds = team.tableIds.filter((id) => !tableIds.includes(id));
    return this.serviceTeamRepository.save(team);
  }

  async saveEventTeams(
    eventId: string,
    teams: Array<{
      id?: string;
      name: string;
      color: string;
      members: TeamMember[];
      leaders?: Array<{
        staffId: string;
        staffName: string;
        role: string;
        shiftStart?: string;
        shiftEnd?: string;
      }>;
      leaderId?: string;
      tableIds: string[];
    }>,
  ): Promise<{
    success: boolean;
    savedCount: number;
    teams: Array<{ id: string; name: string; originalId?: string }>;
  }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const teamRepo = manager.getRepository(ServiceTeam);

        await teamRepo.delete({ eventId });

        if (!teams || teams.length === 0) {
          return { success: true, savedCount: 0, teams: [] };
        }

        const teamEntities = teams.map((teamData, index) => {
          return teamRepo.create({
            eventId,
            name: teamData.name || `Takım ${index + 1}`,
            color: teamData.color || "#3b82f6",
            members: teamData.members || [],
            leaders: teamData.leaders || [],
            leaderId: teamData.leaderId,
            tableIds: teamData.tableIds || [],
          });
        });

        const savedTeams = await teamRepo.save(teamEntities);

        const teamMapping = savedTeams.map((saved, index) => ({
          id: saved.id,
          name: saved.name,
          originalId: teams[index].id,
        }));

        return {
          success: true,
          savedCount: teamEntities.length,
          teams: teamMapping,
        };
      });
    } catch (error) {
      console.error("❌ saveEventTeams error:", error);
      console.error("❌ Error stack:", error.stack);
      console.error("❌ Teams data:", JSON.stringify(teams, null, 2));
      throw error;
    }
  }

  // ==================== TABLE GROUP METHODS ====================

  async getEventTableGroups(eventId: string): Promise<TableGroup[]> {
    return this.tableGroupRepository.find({
      where: { eventId },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  async getTableGroupById(groupId: string): Promise<TableGroup> {
    const group = await this.tableGroupRepository.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException("Masa grubu bulunamadı");
    }
    return group;
  }

  async createTableGroup(dto: {
    eventId: string;
    name: string;
    color?: string;
    tableIds: string[];
    groupType?: string;
    notes?: string;
  }): Promise<TableGroup> {
    const existingGroups = await this.tableGroupRepository.find({
      where: { eventId: dto.eventId },
    });

    for (const group of existingGroups) {
      const filteredTableIds = group.tableIds.filter(
        (id) => !dto.tableIds.includes(id),
      );
      if (filteredTableIds.length !== group.tableIds.length) {
        group.tableIds = filteredTableIds;
        await this.tableGroupRepository.save(group);
      }
    }

    const maxOrder = existingGroups.reduce(
      (max, g) => Math.max(max, g.sortOrder),
      0,
    );

    const tableGroup = this.tableGroupRepository.create({
      eventId: dto.eventId,
      name: dto.name,
      color: dto.color || "#3b82f6",
      tableIds: dto.tableIds,
      groupType: dto.groupType || "standard",
      notes: dto.notes,
      sortOrder: maxOrder + 1,
    });

    return this.tableGroupRepository.save(tableGroup);
  }

  async updateTableGroup(
    groupId: string,
    dto: {
      name?: string;
      color?: string;
      tableIds?: string[];
      groupType?: string;
      notes?: string;
      assignedTeamId?: string;
      assignedSupervisorId?: string;
      sortOrder?: number;
    },
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    if (dto.tableIds) {
      const otherGroups = await this.tableGroupRepository.find({
        where: { eventId: group.eventId },
      });

      for (const otherGroup of otherGroups) {
        if (otherGroup.id !== groupId) {
          const filteredTableIds = otherGroup.tableIds.filter(
            (id) => !dto.tableIds!.includes(id),
          );
          if (filteredTableIds.length !== otherGroup.tableIds.length) {
            otherGroup.tableIds = filteredTableIds;
            await this.tableGroupRepository.save(otherGroup);
          }
        }
      }
    }

    Object.assign(group, dto);
    return this.tableGroupRepository.save(group);
  }

  async deleteTableGroup(groupId: string): Promise<{ success: boolean }> {
    const result = await this.tableGroupRepository.delete(groupId);
    if (result.affected === 0) {
      throw new NotFoundException("Masa grubu bulunamadı");
    }
    return { success: true };
  }

  async addTablesToGroup(
    groupId: string,
    tableIds: string[],
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    const otherGroups = await this.tableGroupRepository.find({
      where: { eventId: group.eventId },
    });

    for (const otherGroup of otherGroups) {
      if (otherGroup.id !== groupId) {
        const filteredTableIds = otherGroup.tableIds.filter(
          (id) => !tableIds.includes(id),
        );
        if (filteredTableIds.length !== otherGroup.tableIds.length) {
          otherGroup.tableIds = filteredTableIds;
          await this.tableGroupRepository.save(otherGroup);
        }
      }
    }

    group.tableIds = [...new Set([...group.tableIds, ...tableIds])];
    return this.tableGroupRepository.save(group);
  }

  async removeTablesFromGroup(
    groupId: string,
    tableIds: string[],
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);
    group.tableIds = group.tableIds.filter((id) => !tableIds.includes(id));
    return this.tableGroupRepository.save(group);
  }

  async assignSupervisorToGroup(
    groupId: string,
    supervisorId: string,
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    const supervisor = await this.userRepository.findOne({
      where: { id: supervisorId, role: UserRole.STAFF },
    });
    if (!supervisor) {
      throw new NotFoundException("Süpervizör bulunamadı");
    }

    group.assignedSupervisorId = supervisorId;
    group.color = supervisor.color || group.color;

    return this.tableGroupRepository.save(group);
  }

  async removeSupervisorFromGroup(groupId: string): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);
    group.assignedSupervisorId = undefined;
    return this.tableGroupRepository.save(group);
  }

  async assignTeamToGroup(
    groupId: string,
    teamId: string,
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    let team = await this.teamRepository.findOne({ where: { id: teamId } });

    if (!team) {
      const serviceTeam = await this.serviceTeamRepository.findOne({
        where: { id: teamId },
      });
      if (!serviceTeam) {
        throw new NotFoundException("Ekip bulunamadı");
      }

      group.assignedTeamId = teamId;
      group.color = serviceTeam.color;

      serviceTeam.tableIds = [
        ...new Set([...serviceTeam.tableIds, ...group.tableIds]),
      ];
      await this.serviceTeamRepository.save(serviceTeam);

      await this.syncStaffTeamIdByTableGroup(
        group.eventId,
        group.tableIds,
        teamId,
      );

      return this.tableGroupRepository.save(group);
    }

    group.assignedTeamId = teamId;
    group.color = team.color;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(teamId)) {
      await this.syncStaffTeamIdByTableGroup(
        group.eventId,
        group.tableIds,
        teamId,
      );
    }

    return this.tableGroupRepository.save(group);
  }

  private async syncStaffTeamIdByTableGroup(
    eventId: string,
    tableIds: string[],
    teamId: string,
  ): Promise<void> {
    if (!tableIds || tableIds.length === 0) return;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(teamId)) {
      return;
    }

    const assignments = await this.eventStaffAssignmentRepository.find({
      where: { eventId, isActive: true },
    });

    for (const assignment of assignments) {
      if (!assignment.tableIds || assignment.tableIds.length === 0) continue;

      const hasMatchingTable = assignment.tableIds.some((tid) =>
        tableIds.includes(tid),
      );

      if (hasMatchingTable && assignment.teamId !== teamId) {
        assignment.teamId = teamId;
        await this.eventStaffAssignmentRepository.save(assignment);
      }
    }
  }

  async saveEventTableGroups(
    eventId: string,
    groups: Array<{
      id?: string;
      name: string;
      color: string;
      tableIds: string[];
      groupType?: string;
      assignedTeamId?: string;
      assignedSupervisorId?: string;
      notes?: string;
      sortOrder?: number;
    }>,
  ): Promise<{ success: boolean; savedCount: number }> {
    if (!eventId) {
      throw new BadRequestException("eventId gerekli");
    }

    if (!groups || !Array.isArray(groups)) {
      return { success: true, savedCount: 0 };
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const tableGroupRepo = manager.getRepository(TableGroup);
        const eventStaffRepo = manager.getRepository(EventStaffAssignment);

        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        await tableGroupRepo.delete({ eventId });

        if (groups.length === 0) {
          return { success: true, savedCount: 0 };
        }

        const groupEntities: TableGroup[] = groups.map((groupData, i) => {
          const safeTableIds = Array.isArray(groupData.tableIds)
            ? groupData.tableIds
            : [];
          const safeName = groupData.name || `Grup ${i + 1}`;
          const safeColor = groupData.color || "#3b82f6";

          const validTeamId =
            groupData.assignedTeamId && uuidRegex.test(groupData.assignedTeamId)
              ? groupData.assignedTeamId
              : null;

          const validSupervisorId =
            groupData.assignedSupervisorId &&
            uuidRegex.test(groupData.assignedSupervisorId)
              ? groupData.assignedSupervisorId
              : null;

          const entity = new TableGroup();
          entity.eventId = eventId;
          entity.name = safeName;
          entity.color = safeColor;
          entity.tableIds = safeTableIds;
          entity.groupType = groupData.groupType || "standard";
          entity.assignedTeamId = validTeamId ?? undefined;
          entity.assignedSupervisorId = validSupervisorId ?? undefined;
          entity.notes = groupData.notes || undefined;
          entity.sortOrder = groupData.sortOrder ?? i;
          return entity;
        });

        await tableGroupRepo.save(groupEntities);

        return { success: true, savedCount: groupEntities.length };
      });
    } catch (error) {
      console.error("❌ saveEventTableGroups error:", error);
      console.error("❌ Error stack:", error.stack);
      console.error("❌ Groups data:", JSON.stringify(groups, null, 2));
      throw error;
    }
  }

  async getSupervisors(): Promise<User[]> {
    return this.userRepository.find({
      where: [
        {
          role: UserRole.STAFF,
          position: "supervizor",
          isActive: true,
        },
        { role: UserRole.STAFF, position: "sef", isActive: true },
      ],
      select: [
        "id",
        "fullName",
        "email",
        "phone",
        "color",
        "position",
        "avatar",
        "isActive",
      ],
      order: { position: "ASC", fullName: "ASC" },
    });
  }

  async getEventOrganizationSummary(eventId: string): Promise<{
    totalStaff: number;
    totalTeams: number;
    totalTableGroups: number;
    assignedTables: number;
    unassignedTables: number;
    supervisorCount: number;
  }> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    const totalTables = event?.venueLayout?.tables?.length || 0;

    const teams = await this.serviceTeamRepository.find({ where: { eventId } });
    const tableGroups = await this.tableGroupRepository.find({
      where: { eventId },
    });
    const staff = await this.userRepository.count({
      where: { role: UserRole.STAFF, isActive: true },
    });
    const supervisors = await this.userRepository.count({
      where: [
        {
          role: UserRole.STAFF,
          position: "supervizor",
          isActive: true,
        },
        { role: UserRole.STAFF, position: "sef", isActive: true },
      ],
    });

    const assignedTableIds = new Set<string>();
    tableGroups.forEach((g) =>
      g.tableIds.forEach((id) => assignedTableIds.add(id)),
    );

    return {
      totalStaff: staff,
      totalTeams: teams.length,
      totalTableGroups: tableGroups.length,
      assignedTables: assignedTableIds.size,
      unassignedTables: totalTables - assignedTableIds.size,
      supervisorCount: supervisors,
    };
  }

  // ==================== TEAM (GLOBAL) METHODS ====================

  async getAllTeams(): Promise<any[]> {
    const teams = await this.teamRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", name: "ASC" },
    });

    if (teams.length === 0) return [];

    const allMemberIds = new Set<string>();
    teams.forEach((team) => {
      if (team.leaderId) allMemberIds.add(team.leaderId);
      team.memberIds?.forEach((id) => allMemberIds.add(id));
    });

    let staffMap = new Map<string, Staff>();
    if (allMemberIds.size > 0) {
      const allStaff = await this.staffRepository
        .createQueryBuilder("staff")
        .where("staff.id IN (:...ids)", { ids: Array.from(allMemberIds) })
        .select([
          "staff.id",
          "staff.fullName",
          "staff.email",
          "staff.color",
          "staff.position",
          "staff.avatar",
        ])
        .getMany();

      allStaff.forEach((s) => staffMap.set(s.id, s));
    }

    return teams.map((team) => {
      const members = (team.memberIds || [])
        .map((id) => staffMap.get(id))
        .filter(Boolean);

      const leader = team.leaderId ? staffMap.get(team.leaderId) : null;

      return {
        ...team,
        members,
        leader,
      };
    });
  }

  async getTeamById(id: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id },
    });
    if (!team) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return team;
  }

  async createTeam(dto: {
    name: string;
    color?: string;
    memberIds?: string[];
    leaderId?: string;
  }): Promise<Team> {
    const existing = await this.teamRepository.findOne({
      where: { name: dto.name, isActive: true },
    });

    if (existing) {
      throw new BadRequestException("Bu isimde bir ekip zaten var");
    }

    const maxSort = await this.teamRepository
      .createQueryBuilder("team")
      .select("MAX(team.sortOrder)", "max")
      .getRawOne();

    let memberIds = dto.memberIds || [];
    if (dto.leaderId && !memberIds.includes(dto.leaderId)) {
      memberIds = [dto.leaderId, ...memberIds];
    }

    const team = this.teamRepository.create({
      name: dto.name,
      color: dto.color || "#3b82f6",
      memberIds,
      leaderId: dto.leaderId || undefined,
      sortOrder: (maxSort?.max || 0) + 1,
    });

    return this.teamRepository.save(team);
  }

  async updateTeam(
    id: string,
    dto: {
      name?: string;
      color?: string;
      memberIds?: string[];
      leaderId?: string;
      sortOrder?: number;
    },
  ): Promise<Team> {
    const team = await this.getTeamById(id);

    if (dto.name && dto.name !== team.name) {
      const existing = await this.teamRepository.findOne({
        where: { name: dto.name, isActive: true },
      });
      if (existing) {
        throw new BadRequestException("Bu isimde bir ekip zaten var");
      }
    }

    if (dto.leaderId) {
      const currentMemberIds = dto.memberIds || team.memberIds || [];
      if (!currentMemberIds.includes(dto.leaderId)) {
        dto.memberIds = [dto.leaderId, ...currentMemberIds];
      }
    }

    Object.assign(team, dto);
    return this.teamRepository.save(team);
  }

  async setTeamLeader(teamId: string, leaderId: string | null): Promise<Team> {
    if (!leaderId) {
      await this.teamRepository
        .createQueryBuilder()
        .update()
        .set({ leaderId: () => "NULL" })
        .where("id = :id", { id: teamId })
        .execute();
    } else {
      await this.teamRepository
        .createQueryBuilder()
        .update()
        .set({ leaderId })
        .where("id = :id", { id: teamId })
        .execute();
    }

    return this.getTeamById(teamId);
  }

  async deleteTeam(id: string): Promise<{ success: boolean; message: string }> {
    const team = await this.getTeamById(id);
    team.isActive = false;
    await this.teamRepository.save(team);
    return { success: true, message: "Ekip silindi" };
  }

  async bulkDeleteTeams(
    teamIds: string[],
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    if (!teamIds || teamIds.length === 0) {
      throw new BadRequestException("Silinecek ekip seçilmedi");
    }

    const result = await this.teamRepository
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where("id IN (:...ids)", { ids: teamIds })
      .andWhere("isActive = :active", { active: true })
      .execute();

    const deletedCount = result.affected || 0;

    return {
      success: true,
      deletedCount,
      message: `${deletedCount} ekip silindi`,
    };
  }

  async addMemberToTeam(teamId: string, memberId: string): Promise<Team> {
    const team = await this.getTeamById(teamId);
    if (!team.memberIds.includes(memberId)) {
      team.memberIds.push(memberId);
      await this.teamRepository.save(team);
    }
    return team;
  }

  async addMembersToTeamBulk(
    teamId: string,
    memberIds: string[],
  ): Promise<Team> {
    const team = await this.getTeamById(teamId);
    const newMemberIds = memberIds.filter((id) => !team.memberIds.includes(id));
    if (newMemberIds.length > 0) {
      team.memberIds = [...team.memberIds, ...newMemberIds];
      await this.teamRepository.save(team);
    }
    return this.getTeamById(teamId);
  }

  async removeMemberFromTeam(teamId: string, memberId: string): Promise<Team> {
    const team = await this.getTeamById(teamId);
    team.memberIds = team.memberIds.filter((id) => id !== memberId);
    await this.teamRepository.save(team);
    return team;
  }

  // ==================== ORGANIZATION TEMPLATE METHODS ====================

  async getOrganizationTemplates(): Promise<OrganizationTemplate[]> {
    return this.organizationTemplateRepository.find({
      where: { isActive: true },
      order: { isDefault: "DESC", createdAt: "DESC" },
    });
  }

  async getOrganizationTemplateById(id: string): Promise<OrganizationTemplate> {
    const template = await this.organizationTemplateRepository.findOne({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException("Şablon bulunamadı");
    }
    return template;
  }

  async createOrganizationTemplate(dto: {
    name: string;
    description?: string;
    createdById?: string;
    eventId: string;
  }): Promise<OrganizationTemplate> {
    const staffAssignments = await this.eventStaffAssignmentRepository.find({
      where: { eventId: dto.eventId, isActive: true },
      relations: ["staff"],
    });

    const tableGroups = await this.tableGroupRepository.find({
      where: { eventId: dto.eventId },
    });

    const serviceTeams = await this.serviceTeamRepository.find({
      where: { eventId: dto.eventId },
    });
    const teamMap = new Map(serviceTeams.map((t) => [t.id, t]));

    const supervisorIds = tableGroups
      .map((g) => g.assignedSupervisorId)
      .filter((id): id is string => !!id);
    const supervisors =
      supervisorIds.length > 0
        ? await this.userRepository.find({
            where: supervisorIds.map((id) => ({ id })),
            select: ["id", "fullName"],
          })
        : [];
    const supervisorMap = new Map(supervisors.map((s) => [s.id, s.fullName]));

    const template = this.organizationTemplateRepository.create({
      name: dto.name,
      description: dto.description,
      createdById: dto.createdById,
      staffAssignments: staffAssignments.map((a) => {
        const team = a.teamId ? teamMap.get(a.teamId) : null;
        return {
          staffId: a.staffId,
          staffName: a.staff?.fullName,
          tableIds: a.tableIds,
          shiftId: a.shiftId,
          teamId: a.teamId,
          teamName: team?.name,
          color: a.color,
        };
      }),
      tableGroups: tableGroups.map((g) => {
        const team = g.assignedTeamId ? teamMap.get(g.assignedTeamId) : null;
        return {
          name: g.name,
          color: g.color,
          tableIds: g.tableIds,
          groupType: g.groupType,
          assignedTeamId: g.assignedTeamId,
          assignedTeamName: team?.name,
          assignedSupervisorId: g.assignedSupervisorId,
          assignedSupervisorName: g.assignedSupervisorId
            ? supervisorMap.get(g.assignedSupervisorId)
            : undefined,
        };
      }),
    });

    return this.organizationTemplateRepository.save(template);
  }

  async applyOrganizationTemplate(
    templateId: string,
    eventId: string,
  ): Promise<{ success: boolean; message: string }> {
    const template = await this.getOrganizationTemplateById(templateId);

    await this.eventStaffAssignmentRepository.update(
      { eventId, isActive: true },
      { isActive: false },
    );
    await this.tableGroupRepository.delete({ eventId });
    await this.serviceTeamRepository.delete({ eventId });

    const teamNameToIdMap = new Map<string, string>();

    const uniqueTeamNames = new Set<string>();
    const teamColorMap = new Map<string, string>();

    for (const group of template.tableGroups) {
      if (group.assignedTeamName) {
        uniqueTeamNames.add(group.assignedTeamName);
        teamColorMap.set(group.assignedTeamName, group.color);
      }
    }

    for (const teamName of uniqueTeamNames) {
      const newTeam = this.serviceTeamRepository.create({
        eventId,
        name: teamName,
        color: teamColorMap.get(teamName) || "#3b82f6",
        members: [],
        tableIds: [],
      });
      const savedTeam = await this.serviceTeamRepository.save(newTeam);
      teamNameToIdMap.set(teamName, savedTeam.id);
    }

    const allActiveStaff = await this.userRepository.find({
      where: { isActive: true },
      select: ["id", "fullName", "color"],
    });
    const staffNameToIdMap = new Map<string, { id: string; color: string }>();
    allActiveStaff.forEach((s) => {
      if (s.fullName) {
        staffNameToIdMap.set(s.fullName.toLowerCase(), {
          id: s.id,
          color: s.color,
        });
      }
    });

    for (const assignment of template.staffAssignments) {
      let staff = await this.userRepository.findOne({
        where: { id: assignment.staffId, isActive: true },
      });

      if (!staff && assignment.staffName) {
        const matchedStaff = staffNameToIdMap.get(
          assignment.staffName.toLowerCase(),
        );
        if (matchedStaff) {
          staff = await this.userRepository.findOne({
            where: { id: matchedStaff.id, isActive: true },
          });
        }
      }

      if (!staff) continue;

      let newTeamId: string | undefined;
      if (assignment.teamName) {
        newTeamId = teamNameToIdMap.get(assignment.teamName);
      }

      const newAssignment = this.eventStaffAssignmentRepository.create({
        eventId,
        staffId: staff.id,
        tableIds: assignment.tableIds,
        shiftId: assignment.shiftId,
        teamId: newTeamId,
        color: assignment.color || staff.color,
        isActive: true,
      });
      await this.eventStaffAssignmentRepository.save(newAssignment);
    }

    for (const group of template.tableGroups) {
      let newAssignedTeamId: string | undefined;
      if (group.assignedTeamName) {
        newAssignedTeamId = teamNameToIdMap.get(group.assignedTeamName);
      }

      let newSupervisorId: string | undefined;
      if (group.assignedSupervisorName) {
        const matchedSupervisor = staffNameToIdMap.get(
          group.assignedSupervisorName.toLowerCase(),
        );
        if (matchedSupervisor) {
          newSupervisorId = matchedSupervisor.id;
        }
      }

      const newGroup = this.tableGroupRepository.create({
        eventId,
        name: group.name,
        color: group.color,
        tableIds: group.tableIds,
        groupType: group.groupType,
        assignedTeamId: newAssignedTeamId,
        assignedSupervisorId: newSupervisorId,
      });
      const savedGroup = await this.tableGroupRepository.save(newGroup);

      if (newAssignedTeamId) {
        const team = await this.serviceTeamRepository.findOne({
          where: { id: newAssignedTeamId },
        });
        if (team) {
          team.tableIds = [
            ...new Set([...team.tableIds, ...savedGroup.tableIds]),
          ];
          await this.serviceTeamRepository.save(team);
        }
      }
    }

    return { success: true, message: "Şablon uygulandı" };
  }

  async deleteOrganizationTemplate(id: string): Promise<{ success: boolean }> {
    const template = await this.getOrganizationTemplateById(id);
    template.isActive = false;
    await this.organizationTemplateRepository.save(template);
    return { success: true };
  }

  async setDefaultTemplate(id: string): Promise<OrganizationTemplate> {
    await this.organizationTemplateRepository.update(
      { isDefault: true },
      { isDefault: false },
    );

    const template = await this.getOrganizationTemplateById(id);
    template.isDefault = true;
    return this.organizationTemplateRepository.save(template);
  }
}
