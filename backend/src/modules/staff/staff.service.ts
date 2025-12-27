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
  ServiceTeam,
  TableGroup,
  StaffRole,
  WorkShift,
  Team,
  EventStaffAssignment,
  OrganizationTemplate,
} from "../../entities";
import { TeamMember } from "../../entities/service-team.entity";
import { UserRole } from "../../entities/user.entity";
import * as bcrypt from "bcrypt";
import { NotificationsService } from "../notifications/notifications.service";

// Varsayılan personel renkleri
const DEFAULT_STAFF_COLORS = [
  "#ef4444", // Kırmızı
  "#22c55e", // Yeşil
  "#3b82f6", // Mavi
  "#eab308", // Sarı
  "#8b5cf6", // Mor
  "#f97316", // Turuncu
  "#06b6d4", // Cyan
  "#ec4899", // Pembe
  "#14b8a6", // Teal
  "#f59e0b", // Amber
];

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffAssignment)
    private assignmentRepository: Repository<StaffAssignment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(ServiceTeam)
    private serviceTeamRepository: Repository<ServiceTeam>,
    @InjectRepository(TableGroup)
    private tableGroupRepository: Repository<TableGroup>,
    @InjectRepository(StaffRole)
    private staffRoleRepository: Repository<StaffRole>,
    @InjectRepository(WorkShift)
    private workShiftRepository: Repository<WorkShift>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(EventStaffAssignment)
    private eventStaffAssignmentRepository: Repository<EventStaffAssignment>,
    @InjectRepository(OrganizationTemplate)
    private organizationTemplateRepository: Repository<OrganizationTemplate>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

  // Personel listesi (role = 'staff' veya 'leader')
  async findAllStaff(onlyActive = false): Promise<User[]> {
    const baseWhere = [{ role: UserRole.STAFF }, { role: UserRole.LEADER }];

    let where: any;
    if (onlyActive) {
      where = baseWhere.map((w) => ({ ...w, isActive: true }));
    } else {
      where = baseWhere;
    }

    return this.userRepository.find({
      where,
      select: [
        "id",
        "fullName",
        "email",
        "phone",
        "color",
        "position",
        "avatar",
        "isActive",
        "createdAt",
      ],
      order: { fullName: "ASC" },
    });
  }

  // Tek personel getir
  async getStaffById(id: string): Promise<User> {
    const staff = await this.userRepository.findOne({
      where: [
        { id, role: UserRole.STAFF },
        { id, role: UserRole.LEADER },
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
        "createdAt",
      ],
    });

    if (!staff) {
      throw new NotFoundException("Personel bulunamadı");
    }

    return staff;
  }

  // Yeni personel oluştur
  async createStaff(dto: {
    email: string;
    fullName: string;
    password: string;
    phone?: string;
    color?: string;
    position?: string;
    avatar?: string;
  }): Promise<User> {
    // Email kontrolü
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException("Bu email adresi zaten kullanılıyor");
    }

    // Renk atanmamışsa otomatik ata
    let color = dto.color;
    if (!color) {
      const staffCount = await this.userRepository.count({
        where: [{ role: UserRole.STAFF }, { role: UserRole.LEADER }],
      });
      color = DEFAULT_STAFF_COLORS[staffCount % DEFAULT_STAFF_COLORS.length];
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Captan ve Supervizor için role=leader, diğerleri için role=staff
    const leaderPositions = ["captan", "supervizor", "sef"];
    const role = leaderPositions.includes(dto.position?.toLowerCase() || "")
      ? UserRole.LEADER
      : UserRole.STAFF;

    const staff = this.userRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      password: hashedPassword,
      phone: dto.phone,
      color,
      position: dto.position,
      avatar: dto.avatar,
      role,
      isActive: true,
    });

    const saved = await this.userRepository.save(staff);

    // Bildirim gönder: Yeni personel eklendi
    try {
      await this.notificationsService.notifyNewStaffAdded(
        saved.fullName,
        saved.position || "Personel",
        "" // createdById - controller'dan geçirilecek
      );
    } catch {
      // Bildirim hatası ana işlemi etkilemesin
    }

    // Şifreyi response'dan çıkar
    const { password, ...result } = saved;
    return result as User;
  }

  // Personel güncelle
  async updateStaff(
    id: string,
    dto: {
      fullName?: string;
      phone?: string;
      color?: string;
      position?: string;
      avatar?: string;
      isActive?: boolean;
    }
  ): Promise<User> {
    const staff = await this.userRepository.findOne({
      where: [
        { id, role: UserRole.STAFF },
        { id, role: UserRole.LEADER },
      ],
    });

    if (!staff) {
      throw new NotFoundException("Personel bulunamadı");
    }

    // Pozisyon değiştiyse role'u da güncelle
    if (dto.position) {
      const leaderPositions = ["captan", "supervizor", "sef"];
      staff.role = leaderPositions.includes(dto.position.toLowerCase())
        ? UserRole.LEADER
        : UserRole.STAFF;
    }

    Object.assign(staff, dto);
    const saved = await this.userRepository.save(staff);

    const { password, ...result } = saved;
    return result as User;
  }

  // Personeli deaktif et (soft delete)
  async deactivateStaff(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    const staff = await this.userRepository.findOne({
      where: [
        { id, role: UserRole.STAFF },
        { id, role: UserRole.LEADER },
      ],
    });

    if (!staff) {
      throw new NotFoundException("Personel bulunamadı");
    }

    staff.isActive = false;
    await this.userRepository.save(staff);

    return { success: true, message: "Personel deaktif edildi" };
  }

  // Etkinlik için masa ataması yap
  async assignTables(
    eventId: string,
    staffId: string,
    tableIds: string[],
    color?: string
  ): Promise<StaffAssignment> {
    // Personel kontrolü
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

  // Toplu atama
  async bulkAssignTables(
    eventId: string,
    assignments: Array<{ staffId: string; tableIds: string[] }>
  ): Promise<StaffAssignment[]> {
    const results: StaffAssignment[] = [];

    for (const item of assignments) {
      const result = await this.assignTables(
        eventId,
        item.staffId,
        item.tableIds
      );
      results.push(result);
    }

    return results;
  }

  // Atama kaldır
  async removeAssignment(
    eventId: string,
    staffId: string
  ): Promise<{ success: boolean }> {
    await this.assignmentRepository.delete({ eventId, staffId });
    return { success: true };
  }

  // Etkinlik için tüm atamaları getir
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

  // Etkinlik atama özeti
  async getEventAssignmentSummary(eventId: string): Promise<{
    totalStaff: number;
    assignedStaff: number;
    totalTables: number;
    assignedTables: number;
    unassignedTables: number;
    avgTablesPerStaff: number;
  }> {
    // Etkinlik bilgisi
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    const totalTables = event?.venueLayout?.tables?.length || 0;

    // Atamalar
    const assignments = await this.assignmentRepository.find({
      where: { eventId },
    });
    const assignedStaff = assignments.length;

    // Atanmış masa sayısı (unique)
    const assignedTableIds = new Set<string>();
    assignments.forEach((a) => {
      a.assignedTableIds?.forEach((id) => assignedTableIds.add(id));
    });
    const assignedTables = assignedTableIds.size;

    // Toplam personel
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

  // Personelin baktığı masaları getir
  async getStaffTables(eventId: string, staffId: string): Promise<string[]> {
    const assignment = await this.assignmentRepository.findOne({
      where: { eventId, staffId },
    });
    return assignment?.assignedTableIds || [];
  }

  // Otomatik atama
  async autoAssignTables(
    eventId: string,
    staffIds: string[],
    strategy: "balanced" | "zone" | "random" = "balanced"
  ): Promise<Array<{ staffId: string; tableIds: string[] }>> {
    if (staffIds.length === 0) {
      throw new BadRequestException("En az bir personel seçilmeli");
    }

    // Etkinlik ve masaları getir
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
    // Loca hariç masalar
    const assignableTables = tables.filter(
      (t) => t.typeName?.toLowerCase() !== "loca" && t.type !== "loca"
    );

    if (assignableTables.length === 0) {
      return staffIds.map((id) => ({ staffId: id, tableIds: [] }));
    }

    const result: Array<{ staffId: string; tableIds: string[] }> = [];

    if (strategy === "balanced") {
      // Dengeli dağıtım - her personele eşit sayıda masa
      const tablesPerStaff = Math.ceil(
        assignableTables.length / staffIds.length
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
      // Bölge bazlı - masaları X koordinatına göre böl
      const sortedTables = [...assignableTables].sort((a, b) => a.x - b.x);
      const zoneSize = Math.ceil(sortedTables.length / staffIds.length);

      for (let i = 0; i < staffIds.length; i++) {
        const start = i * zoneSize;
        const end = Math.min(start + zoneSize, sortedTables.length);
        const tableIds = sortedTables.slice(start, end).map((t) => t.id);
        result.push({ staffId: staffIds[i], tableIds });
      }
    } else {
      // Random dağıtım
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

  // Tüm atamaları kaydet
  async saveEventAssignments(
    eventId: string,
    assignments: Array<{ staffId: string; tableIds: string[]; color?: string }>
  ): Promise<{ success: boolean; savedCount: number }> {
    // Önce mevcut atamaları sil
    await this.assignmentRepository.delete({ eventId });

    // Yeni atamaları kaydet (tableIds boş olsa bile kaydet - ekip ataması için)
    let savedCount = 0;
    for (const item of assignments) {
      const staff = await this.userRepository.findOne({
        where: { id: item.staffId },
      });

      const assignment = this.assignmentRepository.create({
        eventId,
        staffId: item.staffId,
        assignedTableIds: item.tableIds || [],
        color: item.color || staff?.color,
      });
      await this.assignmentRepository.save(assignment);
      savedCount++;
    }

    return { success: true, savedCount };
  }

  // ==================== TEAM METODLARI ====================

  // ==================== SERVICE TEAM METODLARI (ETKİNLİK BAZLI) ====================

  // Etkinlik için tüm ekipleri getir
  async getEventTeams(eventId: string): Promise<ServiceTeam[]> {
    return this.serviceTeamRepository.find({
      where: { eventId },
      order: { createdAt: "ASC" },
    });
  }

  // Tek servis ekibi getir
  async getServiceTeamById(teamId: string): Promise<ServiceTeam> {
    const team = await this.serviceTeamRepository.findOne({
      where: { id: teamId },
    });
    if (!team) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return team;
  }

  // Yeni servis ekibi oluştur
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

  // Servis ekibi güncelle
  async updateServiceTeam(
    teamId: string,
    dto: {
      name?: string;
      color?: string;
      members?: TeamMember[];
      leaderId?: string;
      tableIds?: string[];
    }
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);
    Object.assign(team, dto);
    return this.serviceTeamRepository.save(team);
  }

  // Servis ekibi sil
  async deleteServiceTeam(teamId: string): Promise<{ success: boolean }> {
    const result = await this.serviceTeamRepository.delete(teamId);
    if (result.affected === 0) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return { success: true };
  }

  // Servis ekibine üye ekle
  async addMemberToServiceTeam(
    teamId: string,
    member: TeamMember
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);

    // Zaten ekipte mi kontrol et
    if (team.members.some((m) => m.id === member.id)) {
      throw new BadRequestException("Bu personel zaten ekipte");
    }

    team.members.push(member);
    return this.serviceTeamRepository.save(team);
  }

  // Servis ekibinden üye çıkar
  async removeMemberFromServiceTeam(
    teamId: string,
    memberId: string
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);
    team.members = team.members.filter((m) => m.id !== memberId);

    // Eğer çıkarılan kişi lider ise, liderliği kaldır
    if (team.leaderId === memberId) {
      team.leaderId = undefined;
    }

    return this.serviceTeamRepository.save(team);
  }

  // Servis ekibine masa ata
  async assignTablesToServiceTeam(
    teamId: string,
    tableIds: string[]
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);

    // Aynı etkinlikteki diğer ekiplerden bu masaları kaldır
    const otherTeams = await this.serviceTeamRepository.find({
      where: { eventId: team.eventId },
    });

    for (const otherTeam of otherTeams) {
      if (otherTeam.id !== teamId) {
        const filteredTableIds = otherTeam.tableIds.filter(
          (id) => !tableIds.includes(id)
        );
        if (filteredTableIds.length !== otherTeam.tableIds.length) {
          otherTeam.tableIds = filteredTableIds;
          await this.serviceTeamRepository.save(otherTeam);
        }
      }
    }

    // Bu ekibe masaları ekle
    team.tableIds = [...new Set([...team.tableIds, ...tableIds])];
    return this.serviceTeamRepository.save(team);
  }

  // Servis ekibinden masa kaldır
  async removeTablesFromServiceTeam(
    teamId: string,
    tableIds: string[]
  ): Promise<ServiceTeam> {
    const team = await this.getServiceTeamById(teamId);
    team.tableIds = team.tableIds.filter((id) => !tableIds.includes(id));
    return this.serviceTeamRepository.save(team);
  }

  // Tüm servis ekiplerini toplu kaydet (frontend'den gelen tam liste)
  async saveEventTeams(
    eventId: string,
    teams: Array<{
      id?: string;
      name: string;
      color: string;
      members: TeamMember[];
      leaderId?: string;
      tableIds: string[];
    }>
  ): Promise<{ success: boolean; savedCount: number }> {
    // Önce mevcut ekipleri sil
    await this.serviceTeamRepository.delete({ eventId });

    // Yeni ekipleri kaydet
    let savedCount = 0;
    for (const teamData of teams) {
      const team = this.serviceTeamRepository.create({
        eventId,
        name: teamData.name,
        color: teamData.color,
        members: teamData.members,
        leaderId: teamData.leaderId,
        tableIds: teamData.tableIds,
      });
      await this.serviceTeamRepository.save(team);
      savedCount++;
    }

    return { success: true, savedCount };
  }

  // ==================== TABLE GROUP METODLARI ====================

  // Etkinlik için tüm masa gruplarını getir
  async getEventTableGroups(eventId: string): Promise<TableGroup[]> {
    return this.tableGroupRepository.find({
      where: { eventId },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  // Tek masa grubu getir
  async getTableGroupById(groupId: string): Promise<TableGroup> {
    const group = await this.tableGroupRepository.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException("Masa grubu bulunamadı");
    }
    return group;
  }

  // Yeni masa grubu oluştur
  async createTableGroup(dto: {
    eventId: string;
    name: string;
    color?: string;
    tableIds: string[];
    groupType?: string;
    notes?: string;
  }): Promise<TableGroup> {
    // Aynı etkinlikteki diğer gruplardan bu masaları kaldır
    const existingGroups = await this.tableGroupRepository.find({
      where: { eventId: dto.eventId },
    });

    for (const group of existingGroups) {
      const filteredTableIds = group.tableIds.filter(
        (id) => !dto.tableIds.includes(id)
      );
      if (filteredTableIds.length !== group.tableIds.length) {
        group.tableIds = filteredTableIds;
        await this.tableGroupRepository.save(group);
      }
    }

    // Sıralama numarası
    const maxOrder = existingGroups.reduce(
      (max, g) => Math.max(max, g.sortOrder),
      0
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

  // Masa grubu güncelle
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
    }
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    // Eğer tableIds güncellendiyse, diğer gruplardan bu masaları kaldır
    if (dto.tableIds) {
      const otherGroups = await this.tableGroupRepository.find({
        where: { eventId: group.eventId },
      });

      for (const otherGroup of otherGroups) {
        if (otherGroup.id !== groupId) {
          const filteredTableIds = otherGroup.tableIds.filter(
            (id) => !dto.tableIds!.includes(id)
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

  // Masa grubu sil
  async deleteTableGroup(groupId: string): Promise<{ success: boolean }> {
    const result = await this.tableGroupRepository.delete(groupId);
    if (result.affected === 0) {
      throw new NotFoundException("Masa grubu bulunamadı");
    }
    return { success: true };
  }

  // Gruba masa ekle
  async addTablesToGroup(
    groupId: string,
    tableIds: string[]
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    // Diğer gruplardan bu masaları kaldır
    const otherGroups = await this.tableGroupRepository.find({
      where: { eventId: group.eventId },
    });

    for (const otherGroup of otherGroups) {
      if (otherGroup.id !== groupId) {
        const filteredTableIds = otherGroup.tableIds.filter(
          (id) => !tableIds.includes(id)
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

  // Gruptan masa çıkar
  async removeTablesFromGroup(
    groupId: string,
    tableIds: string[]
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);
    group.tableIds = group.tableIds.filter((id) => !tableIds.includes(id));
    return this.tableGroupRepository.save(group);
  }

  // Gruba süpervizör ata
  async assignSupervisorToGroup(
    groupId: string,
    supervisorId: string
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    // Süpervizör kontrolü
    const supervisor = await this.userRepository.findOne({
      where: { id: supervisorId, role: UserRole.STAFF },
    });
    if (!supervisor) {
      throw new NotFoundException("Süpervizör bulunamadı");
    }

    // Süpervizörün rengini gruba uygula
    group.assignedSupervisorId = supervisorId;
    group.color = supervisor.color || group.color;

    return this.tableGroupRepository.save(group);
  }

  // Gruptan süpervizör kaldır
  async removeSupervisorFromGroup(groupId: string): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);
    group.assignedSupervisorId = undefined;
    return this.tableGroupRepository.save(group);
  }

  // Gruba ekip ata
  async assignTeamToGroup(
    groupId: string,
    teamId: string
  ): Promise<TableGroup> {
    const group = await this.getTableGroupById(groupId);

    // Ekip kontrolü - önce yeni Team tablosunda ara
    let team = await this.teamRepository.findOne({ where: { id: teamId } });

    // Yeni tabloda yoksa ServiceTeam'de ara
    if (!team) {
      const serviceTeam = await this.serviceTeamRepository.findOne({
        where: { id: teamId },
      });
      if (!serviceTeam) {
        throw new NotFoundException("Ekip bulunamadı");
      }

      group.assignedTeamId = teamId;
      group.color = serviceTeam.color;

      // ServiceTeam'in tableIds'ini de güncelle
      serviceTeam.tableIds = [
        ...new Set([...serviceTeam.tableIds, ...group.tableIds]),
      ];
      await this.serviceTeamRepository.save(serviceTeam);

      // Bu masa grubundaki masalara atanmış personellerin teamId'sini güncelle
      await this.syncStaffTeamIdByTableGroup(
        group.eventId,
        group.tableIds,
        teamId
      );

      return this.tableGroupRepository.save(group);
    }

    group.assignedTeamId = teamId;
    group.color = team.color;

    // Bu masa grubundaki masalara atanmış personellerin teamId'sini güncelle
    await this.syncStaffTeamIdByTableGroup(
      group.eventId,
      group.tableIds,
      teamId
    );

    return this.tableGroupRepository.save(group);
  }

  // Masa grubundaki masalara atanmış personellerin teamId'sini güncelle
  private async syncStaffTeamIdByTableGroup(
    eventId: string,
    tableIds: string[],
    teamId: string
  ): Promise<void> {
    if (!tableIds || tableIds.length === 0) return;

    // Bu etkinlikteki tüm staff assignment'ları al
    const assignments = await this.eventStaffAssignmentRepository.find({
      where: { eventId, isActive: true },
    });

    // Her assignment için kontrol et - tableIds içinde bu grubun masaları var mı?
    for (const assignment of assignments) {
      if (!assignment.tableIds || assignment.tableIds.length === 0) continue;

      // Personelin atandığı masalardan herhangi biri bu gruptaki masalardan mı?
      const hasMatchingTable = assignment.tableIds.some((tid) =>
        tableIds.includes(tid)
      );

      if (hasMatchingTable && assignment.teamId !== teamId) {
        assignment.teamId = teamId;
        await this.eventStaffAssignmentRepository.save(assignment);
      }
    }
  }

  // Tüm masa gruplarını toplu kaydet
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
    }>
  ): Promise<{ success: boolean; savedCount: number }> {
    // Önce mevcut grupları sil
    await this.tableGroupRepository.delete({ eventId });

    // Yeni grupları kaydet
    let savedCount = 0;
    for (let i = 0; i < groups.length; i++) {
      const groupData = groups[i];
      const tableGroup = this.tableGroupRepository.create({
        eventId,
        name: groupData.name,
        color: groupData.color,
        tableIds: groupData.tableIds,
        groupType: groupData.groupType || "standard",
        assignedTeamId: groupData.assignedTeamId,
        assignedSupervisorId: groupData.assignedSupervisorId,
        notes: groupData.notes,
        sortOrder: groupData.sortOrder ?? i,
      });
      await this.tableGroupRepository.save(tableGroup);

      // Eğer takım atanmışsa, personellerin teamId'sini güncelle
      if (groupData.assignedTeamId && groupData.tableIds.length > 0) {
        await this.syncStaffTeamIdByTableGroup(
          eventId,
          groupData.tableIds,
          groupData.assignedTeamId
        );
      }

      savedCount++;
    }

    return { success: true, savedCount };
  }

  // Süpervizörleri getir (pozisyon = supervizor veya sef)
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

  // Etkinlik için özet istatistikler
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

    // Atanmış masa sayısı
    const assignedTableIds = new Set<string>();
    tableGroups.forEach((g) =>
      g.tableIds.forEach((id) => assignedTableIds.add(id))
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

  // ==================== STAFF ROLE METODLARI ====================

  // Varsayılan rolleri oluştur (ilk kurulumda)
  async seedDefaultRoles(): Promise<StaffRole[]> {
    const existingRoles = await this.staffRoleRepository.find();
    if (existingRoles.length > 0) {
      return existingRoles;
    }

    const defaultRoles = [
      {
        key: "supervizor",
        label: "Süpervizör",
        color: "#ef4444",
        badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
        bgColor: "bg-red-500",
        sortOrder: 1,
      },
      {
        key: "sef",
        label: "Şef",
        color: "#f59e0b",
        badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        bgColor: "bg-amber-500",
        sortOrder: 2,
      },
      {
        key: "garson",
        label: "Garson",
        color: "#3b82f6",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        bgColor: "bg-blue-500",
        sortOrder: 3,
      },
      {
        key: "komi",
        label: "Komi",
        color: "#22c55e",
        badgeColor: "bg-green-500/20 text-green-400 border-green-500/30",
        bgColor: "bg-green-500",
        sortOrder: 4,
      },
      {
        key: "debarasor",
        label: "Debarasör",
        color: "#8b5cf6",
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        bgColor: "bg-purple-500",
        sortOrder: 5,
      },
    ];

    const roles: StaffRole[] = [];
    for (const roleData of defaultRoles) {
      const role = this.staffRoleRepository.create(roleData);
      roles.push(await this.staffRoleRepository.save(role));
    }

    return roles;
  }

  // Tüm rolleri getir
  async getAllRoles(): Promise<StaffRole[]> {
    const roles = await this.staffRoleRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC" },
    });

    // Eğer rol yoksa varsayılanları oluştur
    if (roles.length === 0) {
      return this.seedDefaultRoles();
    }

    return roles;
  }

  // Tek rol getir
  async getRoleById(id: string): Promise<StaffRole> {
    const role = await this.staffRoleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException("Rol bulunamadı");
    }
    return role;
  }

  // Rol key'e göre getir
  async getRoleByKey(key: string): Promise<StaffRole | null> {
    return this.staffRoleRepository.findOne({ where: { key } });
  }

  // Yeni rol oluştur
  async createRole(dto: {
    key: string;
    label: string;
    color: string;
    badgeColor?: string;
    bgColor?: string;
  }): Promise<StaffRole> {
    // Key kontrolü
    const existing = await this.staffRoleRepository.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new BadRequestException("Bu key ile bir rol zaten var");
    }

    // Sıralama numarası
    const maxOrder = await this.staffRoleRepository
      .createQueryBuilder("role")
      .select("MAX(role.sortOrder)", "max")
      .getRawOne();

    const role = this.staffRoleRepository.create({
      key: dto.key,
      label: dto.label,
      color: dto.color,
      badgeColor: dto.badgeColor || this.generateBadgeColor(dto.color),
      bgColor: dto.bgColor || `bg-[${dto.color}]`,
      sortOrder: (maxOrder?.max || 0) + 1,
    });

    return this.staffRoleRepository.save(role);
  }

  // Rol güncelle
  async updateRole(
    id: string,
    dto: {
      label?: string;
      color?: string;
      badgeColor?: string;
      bgColor?: string;
      sortOrder?: number;
    }
  ): Promise<StaffRole> {
    const role = await this.getRoleById(id);

    if (dto.color && !dto.badgeColor) {
      dto.badgeColor = this.generateBadgeColor(dto.color);
    }

    Object.assign(role, dto);
    return this.staffRoleRepository.save(role);
  }

  // Rol sil (soft delete)
  async deleteRole(id: string): Promise<{ success: boolean; message: string }> {
    const role = await this.getRoleById(id);

    // Bu rolde personel var mı kontrol et
    const staffCount = await this.userRepository.count({
      where: { role: UserRole.STAFF, position: role.key as any },
    });

    if (staffCount > 0) {
      throw new BadRequestException(
        `Bu rolde ${staffCount} personel var. Önce personellerin rolünü değiştirin.`
      );
    }

    role.isActive = false;
    await this.staffRoleRepository.save(role);

    return { success: true, message: "Rol silindi" };
  }

  // Rol kalıcı sil
  async hardDeleteRole(id: string): Promise<{ success: boolean }> {
    const role = await this.getRoleById(id);

    // Bu rolde personel var mı kontrol et
    const staffCount = await this.userRepository.count({
      where: { role: UserRole.STAFF, position: role.key as any },
    });

    if (staffCount > 0) {
      throw new BadRequestException(
        `Bu rolde ${staffCount} personel var. Önce personellerin rolünü değiştirin.`
      );
    }

    await this.staffRoleRepository.delete(id);
    return { success: true };
  }

  // Badge rengi oluştur
  private generateBadgeColor(hexColor: string): string {
    // Hex'ten tailwind formatına dönüştür
    const colorMap: Record<string, string> = {
      "#ef4444": "bg-red-500/20 text-red-400 border-red-500/30",
      "#f59e0b": "bg-amber-500/20 text-amber-400 border-amber-500/30",
      "#22c55e": "bg-green-500/20 text-green-400 border-green-500/30",
      "#3b82f6": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "#8b5cf6": "bg-purple-500/20 text-purple-400 border-purple-500/30",
      "#ec4899": "bg-pink-500/20 text-pink-400 border-pink-500/30",
      "#14b8a6": "bg-teal-500/20 text-teal-400 border-teal-500/30",
      "#f97316": "bg-orange-500/20 text-orange-400 border-orange-500/30",
    };

    return (
      colorMap[hexColor] || "bg-slate-500/20 text-slate-400 border-slate-500/30"
    );
  }

  // ==================== WORK SHIFT (ÇALIŞMA SAATLERİ) METODLARI ====================

  // Tüm çalışma saatlerini getir
  async getAllShifts(): Promise<WorkShift[]> {
    return this.workShiftRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", startTime: "ASC" },
    });
  }

  // ID ile çalışma saati getir
  async getShiftById(id: string): Promise<WorkShift> {
    const shift = await this.workShiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new NotFoundException("Çalışma saati bulunamadı");
    }
    return shift;
  }

  // Yeni çalışma saati oluştur
  async createShift(dto: {
    name: string;
    startTime: string;
    endTime: string;
    color?: string;
  }): Promise<WorkShift> {
    // Aynı isimde var mı kontrol et
    const existing = await this.workShiftRepository.findOne({
      where: { name: dto.name, isActive: true },
    });

    if (existing) {
      throw new BadRequestException("Bu isimde bir çalışma saati zaten var");
    }

    // Sıralama için mevcut en yüksek sortOrder'ı bul
    const maxSort = await this.workShiftRepository
      .createQueryBuilder("shift")
      .select("MAX(shift.sortOrder)", "max")
      .getRawOne();

    const shift = this.workShiftRepository.create({
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
      color: dto.color || "#3b82f6",
      sortOrder: (maxSort?.max || 0) + 1,
    });

    return this.workShiftRepository.save(shift);
  }

  // Çalışma saati güncelle
  async updateShift(
    id: string,
    dto: {
      name?: string;
      startTime?: string;
      endTime?: string;
      color?: string;
      sortOrder?: number;
    }
  ): Promise<WorkShift> {
    const shift = await this.getShiftById(id);

    // İsim değişiyorsa, aynı isimde başka var mı kontrol et
    if (dto.name && dto.name !== shift.name) {
      const existing = await this.workShiftRepository.findOne({
        where: { name: dto.name, isActive: true },
      });
      if (existing) {
        throw new BadRequestException("Bu isimde bir çalışma saati zaten var");
      }
    }

    Object.assign(shift, dto);
    return this.workShiftRepository.save(shift);
  }

  // Çalışma saati sil (soft delete)
  async deleteShift(
    id: string
  ): Promise<{ success: boolean; message: string }> {
    const shift = await this.getShiftById(id);
    shift.isActive = false;
    await this.workShiftRepository.save(shift);
    return { success: true, message: "Çalışma saati silindi" };
  }

  // ==================== TEAM (EKİP) METODLARI ====================

  /**
   * Tüm ekipleri getir - OPTİMİZE EDİLDİ
   * N+1 query problemi çözüldü - 4 sorguya indirildi
   * Önceki: 3N+1 sorgu (N = ekip sayısı)
   * Şimdi: 4 sabit sorgu
   */
  async getAllTeams(): Promise<any[]> {
    // 1. Tüm ekipleri tek sorguda getir (leader relation ile)
    const teams = await this.teamRepository.find({
      where: { isActive: true },
      relations: ["leader"],
      order: { sortOrder: "ASC", name: "ASC" },
    });

    if (teams.length === 0) return [];

    // Team ID'lerini topla
    const teamIds = teams.map((t) => t.id);

    // 2. Tüm ekiplere atanmış grupları tek sorguda getir
    const allGroups = await this.tableGroupRepository
      .createQueryBuilder("tg")
      .where("tg.assignedTeamId IN (:...teamIds)", { teamIds })
      .getMany();

    // Team ID -> Groups lookup map oluştur
    const teamGroupsMap = new Map<string, TableGroup[]>();
    const allTableIds = new Set<string>();

    allGroups.forEach((group) => {
      if (group.assignedTeamId) {
        const existing = teamGroupsMap.get(group.assignedTeamId) || [];
        existing.push(group);
        teamGroupsMap.set(group.assignedTeamId, existing);

        // Tüm masa ID'lerini topla
        group.tableIds?.forEach((tid) => allTableIds.add(tid));
      }
    });

    // 3. Tüm masalara atanmış personelleri tek sorguda getir
    let staffAssignments: EventStaffAssignment[] = [];
    if (allTableIds.size > 0) {
      staffAssignments = await this.eventStaffAssignmentRepository
        .createQueryBuilder("esa")
        .where("esa.tableIds && ARRAY[:...tableIds]::text[]", {
          tableIds: Array.from(allTableIds),
        })
        .andWhere("esa.isActive = :isActive", { isActive: true })
        .getMany();
    }

    // Staff ID -> Assignment lookup map oluştur
    const staffAssignmentMap = new Map<
      string,
      { staffId: string; tableIds: string[] }[]
    >();
    const allStaffIds = new Set<string>();

    staffAssignments.forEach((assignment) => {
      if (assignment.staffId) {
        allStaffIds.add(assignment.staffId);
        const existing = staffAssignmentMap.get(assignment.staffId) || [];
        existing.push({
          staffId: assignment.staffId,
          tableIds: assignment.tableIds || [],
        });
        staffAssignmentMap.set(assignment.staffId, existing);
      }
    });

    // Lider ID'lerini de ekle
    teams.forEach((team) => {
      if (team.leaderId) allStaffIds.add(team.leaderId);
      team.memberIds?.forEach((id) => allStaffIds.add(id));
    });

    // 4. Tüm personel bilgilerini tek sorguda getir
    let allUsers: User[] = [];
    if (allStaffIds.size > 0) {
      allUsers = await this.userRepository
        .createQueryBuilder("user")
        .where("user.id IN (:...ids)", { ids: Array.from(allStaffIds) })
        .select([
          "user.id",
          "user.fullName",
          "user.email",
          "user.color",
          "user.position",
          "user.avatar",
        ])
        .getMany();
    }

    // User ID -> User lookup map oluştur
    const userMap = new Map<string, User>();
    allUsers.forEach((user) => userMap.set(user.id, user));

    // Memory'de join işlemi yap
    return teams.map((team) => {
      const teamGroups = teamGroupsMap.get(team.id) || [];
      const teamTableIds = new Set<string>();
      teamGroups.forEach((g) =>
        g.tableIds?.forEach((tid) => teamTableIds.add(tid))
      );

      // Bu ekibin üyelerini bul
      const memberStaffIds = new Set<string>();
      const staffTableMap = new Map<string, string[]>();

      // Lider varsa ekle
      if (team.leaderId) memberStaffIds.add(team.leaderId);

      // Manuel eklenen üyeler
      team.memberIds?.forEach((id) => memberStaffIds.add(id));

      // Masalara atanmış personeller
      staffAssignments.forEach((assignment) => {
        if (!assignment.staffId || !assignment.tableIds) return;

        // Bu personelin masalarından herhangi biri bu ekibin masalarından mı?
        const relevantTables = assignment.tableIds.filter((tid) =>
          teamTableIds.has(tid)
        );

        if (relevantTables.length > 0) {
          memberStaffIds.add(assignment.staffId);
          const existing = staffTableMap.get(assignment.staffId) || [];
          staffTableMap.set(assignment.staffId, [
            ...new Set([...existing, ...relevantTables]),
          ]);
        }
      });

      // Üye bilgilerini lookup map'ten al
      const members = Array.from(memberStaffIds)
        .map((staffId) => {
          const user = userMap.get(staffId);
          if (!user) return null;
          return {
            ...user,
            assignedTables: staffTableMap.get(staffId) || [],
          };
        })
        .filter(Boolean);

      return {
        ...team,
        members,
        assignedGroupCount: teamGroups.length,
        assignedTableCount: teamTableIds.size,
      };
    });
  }

  // ID ile ekip getir
  async getTeamById(id: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: ["leader"],
    });
    if (!team) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return team;
  }

  // Yeni ekip oluştur
  async createTeam(dto: {
    name: string;
    color?: string;
    memberIds?: string[];
    leaderId?: string;
  }): Promise<Team> {
    // Aynı isimde var mı kontrol et
    const existing = await this.teamRepository.findOne({
      where: { name: dto.name, isActive: true },
    });

    if (existing) {
      throw new BadRequestException("Bu isimde bir ekip zaten var");
    }

    // Sıralama için mevcut en yüksek sortOrder'ı bul
    const maxSort = await this.teamRepository
      .createQueryBuilder("team")
      .select("MAX(team.sortOrder)", "max")
      .getRawOne();

    // memberIds'i hazırla - lider varsa ve memberIds'de yoksa ekle
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

  // Ekip güncelle
  async updateTeam(
    id: string,
    dto: {
      name?: string;
      color?: string;
      memberIds?: string[];
      leaderId?: string;
      sortOrder?: number;
    }
  ): Promise<Team> {
    const team = await this.getTeamById(id);

    // İsim değişiyorsa, aynı isimde başka var mı kontrol et
    if (dto.name && dto.name !== team.name) {
      const existing = await this.teamRepository.findOne({
        where: { name: dto.name, isActive: true },
      });
      if (existing) {
        throw new BadRequestException("Bu isimde bir ekip zaten var");
      }
    }

    // Lider değişiyorsa ve memberIds'de yoksa ekle
    if (dto.leaderId) {
      const currentMemberIds = dto.memberIds || team.memberIds || [];
      if (!currentMemberIds.includes(dto.leaderId)) {
        dto.memberIds = [dto.leaderId, ...currentMemberIds];
      }
    }

    Object.assign(team, dto);
    return this.teamRepository.save(team);
  }

  // Ekip sil (soft delete)
  async deleteTeam(id: string): Promise<{ success: boolean; message: string }> {
    const team = await this.getTeamById(id);
    team.isActive = false;
    await this.teamRepository.save(team);
    return { success: true, message: "Ekip silindi" };
  }

  // Ekibe üye ekle
  async addMemberToTeam(teamId: string, memberId: string): Promise<Team> {
    const team = await this.getTeamById(teamId);
    if (!team.memberIds.includes(memberId)) {
      team.memberIds.push(memberId);
      await this.teamRepository.save(team);
    }
    return team;
  }

  // Ekipten üye çıkar
  async removeMemberFromTeam(teamId: string, memberId: string): Promise<Team> {
    const team = await this.getTeamById(teamId);
    team.memberIds = team.memberIds.filter((id) => id !== memberId);
    await this.teamRepository.save(team);
    return team;
  }

  // ==================== EVENT STAFF ASSIGNMENT METODLARI ====================

  // Personelin tüm etkinliklerdeki atamalarını getir (staffId bazlı)
  async getStaffEventAssignments(
    staffId: string
  ): Promise<EventStaffAssignment[]> {
    return this.eventStaffAssignmentRepository.find({
      where: { staffId, isActive: true },
      relations: ["staff", "shift", "team", "event"],
      order: { createdAt: "DESC" },
    });
  }

  // Etkinlik için tüm personel atamalarını getir
  async getEventStaffAssignments(
    eventId: string
  ): Promise<EventStaffAssignment[]> {
    return this.eventStaffAssignmentRepository.find({
      where: { eventId, isActive: true },
      relations: ["staff", "shift", "team"],
      order: { sortOrder: "ASC" },
    });
  }

  // Personel ata (masa/masalara veya özel görev)
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
    // Personel kontrolü
    const staff = await this.userRepository.findOne({
      where: { id: dto.staffId, role: UserRole.STAFF },
    });
    if (!staff) {
      throw new NotFoundException("Personel bulunamadı");
    }

    // Özel görev ise her zaman yeni atama oluştur
    if (dto.assignmentType === "special_task") {
      const assignment = this.eventStaffAssignmentRepository.create({
        eventId: dto.eventId,
        staffId: dto.staffId,
        tableIds: [],
        shiftId: dto.shiftId,
        teamId: dto.teamId,
        color: dto.color || staff.color,
        assignmentType: "special_task",
        specialTaskLocation: dto.specialTaskLocation,
        specialTaskStartTime: dto.specialTaskStartTime,
        specialTaskEndTime: dto.specialTaskEndTime,
      });
      return this.eventStaffAssignmentRepository.save(assignment);
    }

    // Masa ataması - mevcut atama var mı kontrol et
    let assignment = await this.eventStaffAssignmentRepository.findOne({
      where: {
        eventId: dto.eventId,
        staffId: dto.staffId,
        assignmentType: "table",
        isActive: true,
      },
    });

    if (assignment) {
      // Mevcut atamayı güncelle - masaları birleştir
      assignment.tableIds = [
        ...new Set([...assignment.tableIds, ...dto.tableIds]),
      ];
      if (dto.shiftId) assignment.shiftId = dto.shiftId;
      if (dto.teamId) assignment.teamId = dto.teamId;
      if (dto.color) assignment.color = dto.color;
    } else {
      // Yeni atama oluştur
      assignment = this.eventStaffAssignmentRepository.create({
        eventId: dto.eventId,
        staffId: dto.staffId,
        tableIds: dto.tableIds,
        shiftId: dto.shiftId,
        teamId: dto.teamId,
        color: dto.color || staff.color,
        assignmentType: "table",
      });
    }

    return this.eventStaffAssignmentRepository.save(assignment);
  }

  // Personel atamasını güncelle
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
    }
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

  // Personel atamasını kaldır
  async removeStaffAssignment(
    assignmentId: string
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

  // Personeli masalardan kaldır
  async removeStaffFromTables(
    eventId: string,
    staffId: string,
    tableIds: string[]
  ): Promise<EventStaffAssignment | null> {
    const assignment = await this.eventStaffAssignmentRepository.findOne({
      where: { eventId, staffId, isActive: true },
    });
    if (!assignment) return null;

    assignment.tableIds = assignment.tableIds.filter(
      (id) => !tableIds.includes(id)
    );

    if (assignment.tableIds.length === 0) {
      assignment.isActive = false;
    }

    return this.eventStaffAssignmentRepository.save(assignment);
  }

  // Tüm etkinlik atamalarını kaydet (toplu)
  async saveEventStaffAssignments(
    eventId: string,
    assignments: Array<{
      staffId: string;
      tableIds: string[];
      shiftId?: string;
      teamId?: string;
      color?: string;
    }>,
    createdById?: string
  ): Promise<{ success: boolean; savedCount: number }> {
    // Önce mevcut atamaları deaktif et
    await this.eventStaffAssignmentRepository.update(
      { eventId, isActive: true },
      { isActive: false }
    );

    // Yeni atamaları kaydet
    let savedCount = 0;
    for (const item of assignments) {
      if (item.tableIds.length === 0) continue;

      const staff = await this.userRepository.findOne({
        where: { id: item.staffId },
      });

      const assignment = this.eventStaffAssignmentRepository.create({
        eventId,
        staffId: item.staffId,
        tableIds: item.tableIds,
        shiftId: item.shiftId,
        teamId: item.teamId,
        color: item.color || staff?.color,
        isActive: true,
      });
      await this.eventStaffAssignmentRepository.save(assignment);
      savedCount++;
    }

    // Bildirim gönder: Ekip organizasyonu tamamlandı
    if (savedCount > 0 && createdById) {
      try {
        const event = await this.eventRepository.findOne({
          where: { id: eventId },
        });
        if (event) {
          await this.notificationsService.notifyTeamOrganizationCompleted(
            event,
            createdById
          );
        }
      } catch {
        // Bildirim hatası ana işlemi etkilemesin
      }
    }

    return { success: true, savedCount };
  }

  // ==================== ORGANIZATION TEMPLATE METODLARI ====================

  // Tüm şablonları getir
  async getOrganizationTemplates(): Promise<OrganizationTemplate[]> {
    return this.organizationTemplateRepository.find({
      where: { isActive: true },
      order: { isDefault: "DESC", createdAt: "DESC" },
    });
  }

  // Tek şablon getir
  async getOrganizationTemplateById(id: string): Promise<OrganizationTemplate> {
    const template = await this.organizationTemplateRepository.findOne({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException("Şablon bulunamadı");
    }
    return template;
  }

  // Şablon oluştur (mevcut etkinlik organizasyonundan)
  async createOrganizationTemplate(dto: {
    name: string;
    description?: string;
    createdById?: string;
    eventId: string;
  }): Promise<OrganizationTemplate> {
    // Etkinliğin mevcut organizasyonunu al
    const staffAssignments = await this.eventStaffAssignmentRepository.find({
      where: { eventId: dto.eventId, isActive: true },
    });

    const tableGroups = await this.tableGroupRepository.find({
      where: { eventId: dto.eventId },
    });

    const template = this.organizationTemplateRepository.create({
      name: dto.name,
      description: dto.description,
      createdById: dto.createdById,
      staffAssignments: staffAssignments.map((a) => ({
        staffId: a.staffId,
        tableIds: a.tableIds,
        shiftId: a.shiftId,
        teamId: a.teamId,
        color: a.color,
      })),
      tableGroups: tableGroups.map((g) => ({
        name: g.name,
        color: g.color,
        tableIds: g.tableIds,
        groupType: g.groupType,
        assignedTeamId: g.assignedTeamId,
        assignedSupervisorId: g.assignedSupervisorId,
      })),
    });

    return this.organizationTemplateRepository.save(template);
  }

  // Şablonu etkinliğe uygula
  async applyOrganizationTemplate(
    templateId: string,
    eventId: string
  ): Promise<{ success: boolean; message: string }> {
    const template = await this.getOrganizationTemplateById(templateId);

    // Mevcut atamaları temizle
    await this.eventStaffAssignmentRepository.update(
      { eventId, isActive: true },
      { isActive: false }
    );
    await this.tableGroupRepository.delete({ eventId });

    // Personel atamalarını uygula
    for (const assignment of template.staffAssignments) {
      // Personel hala aktif mi kontrol et
      const staff = await this.userRepository.findOne({
        where: { id: assignment.staffId, isActive: true },
      });
      if (!staff) continue;

      const newAssignment = this.eventStaffAssignmentRepository.create({
        eventId,
        staffId: assignment.staffId,
        tableIds: assignment.tableIds,
        shiftId: assignment.shiftId,
        teamId: assignment.teamId,
        color: assignment.color || staff.color,
        isActive: true,
      });
      await this.eventStaffAssignmentRepository.save(newAssignment);
    }

    // Masa gruplarını uygula
    for (const group of template.tableGroups) {
      const newGroup = this.tableGroupRepository.create({
        eventId,
        name: group.name,
        color: group.color,
        tableIds: group.tableIds,
        groupType: group.groupType,
        assignedTeamId: group.assignedTeamId,
        assignedSupervisorId: group.assignedSupervisorId,
      });
      await this.tableGroupRepository.save(newGroup);
    }

    return { success: true, message: "Şablon uygulandı" };
  }

  // Şablon sil
  async deleteOrganizationTemplate(id: string): Promise<{ success: boolean }> {
    const template = await this.getOrganizationTemplateById(id);
    template.isActive = false;
    await this.organizationTemplateRepository.save(template);
    return { success: true };
  }

  // Varsayılan şablon yap
  async setDefaultTemplate(id: string): Promise<OrganizationTemplate> {
    // Önce tüm şablonların varsayılan durumunu kaldır
    await this.organizationTemplateRepository.update(
      { isDefault: true },
      { isDefault: false }
    );

    // Bu şablonu varsayılan yap
    const template = await this.getOrganizationTemplateById(id);
    template.isDefault = true;
    return this.organizationTemplateRepository.save(template);
  }
}
