import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, DataSource } from "typeorm";
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
  Staff,
} from "../../entities";
import { Position } from "../../entities/position.entity";
import { Department } from "../../entities/department.entity";
import { WorkLocation } from "../../entities/work-location.entity";
import { DepartmentPosition } from "../../entities/department-position.entity";
import { DepartmentLocation } from "../../entities/department-location.entity";
import { Gender, StaffStatus } from "../../entities/staff.entity";
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
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(WorkLocation)
    private workLocationRepository: Repository<WorkLocation>,
    @InjectRepository(DepartmentPosition)
    private departmentPositionRepository: Repository<DepartmentPosition>,
    @InjectRepository(DepartmentLocation)
    private departmentLocationRepository: Repository<DepartmentLocation>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private dataSource: DataSource
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

  // Toplu atama - OPTİMİZE EDİLDİ
  async bulkAssignTables(
    eventId: string,
    assignments: Array<{ staffId: string; tableIds: string[] }>
  ): Promise<StaffAssignment[]> {
    if (assignments.length === 0) {
      return [];
    }

    // Tüm staffId'leri topla
    const staffIds = assignments.map((a) => a.staffId);

    // Mevcut atamaları ve personelleri tek sorguda al
    const [existingAssignments, staffMembers] = await Promise.all([
      this.assignmentRepository.find({
        where: staffIds.map((staffId) => ({ eventId, staffId })),
      }),
      this.userRepository.find({
        where: staffIds.map((id) => ({ id })),
        select: ["id", "color"],
      }),
    ]);

    // Map'ler oluştur
    const existingMap = new Map(existingAssignments.map((a) => [a.staffId, a]));
    const colorMap = new Map(staffMembers.map((s) => [s.id, s.color]));

    // Güncellenecek ve yeni eklenecek entity'leri hazırla
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

    // Tek sorguda kaydet
    return this.assignmentRepository.save(toSave);
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

  // Tüm atamaları kaydet - N+1 QUERY DÜZELTİLDİ
  async saveEventAssignments(
    eventId: string,
    assignments: Array<{ staffId: string; tableIds: string[]; color?: string }>
  ): Promise<{ success: boolean; savedCount: number }> {
    // Önce mevcut atamaları sil
    await this.assignmentRepository.delete({ eventId });

    if (assignments.length === 0) {
      return { success: true, savedCount: 0 };
    }

    // TÜM personelleri tek sorguda al (N+1 önleme)
    const staffIds = assignments.map((a) => a.staffId);
    const staffMembers = await this.userRepository.find({
      where: staffIds.map((id) => ({ id })),
      select: ["id", "color"],
    });

    // ID -> color map oluştur
    const staffColorMap = new Map<string, string>();
    staffMembers.forEach((s) => staffColorMap.set(s.id, s.color));

    // Bulk insert için entity'leri hazırla
    const assignmentEntities = assignments.map((item) =>
      this.assignmentRepository.create({
        eventId,
        staffId: item.staffId,
        assignedTableIds: item.tableIds || [],
        color: item.color || staffColorMap.get(item.staffId) || "#3b82f6",
      })
    );

    // Tek sorguda tüm atamaları kaydet
    await this.assignmentRepository.save(assignmentEntities);

    return { success: true, savedCount: assignmentEntities.length };
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
  // Transaction ile atomik işlem - veri kaybı önlenir
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
    }>
  ): Promise<{
    success: boolean;
    savedCount: number;
    teams: Array<{ id: string; name: string; originalId?: string }>;
  }> {
    console.log(
      "📦 saveEventTeams çağrıldı:",
      JSON.stringify({ eventId, teamCount: teams?.length }, null, 2)
    );

    try {
      return await this.dataSource.transaction(async (manager) => {
        const teamRepo = manager.getRepository(ServiceTeam);

        // Mevcut ekipleri sil
        await teamRepo.delete({ eventId });
        console.log("🗑️ Mevcut ekipler silindi");

        if (!teams || teams.length === 0) {
          return { success: true, savedCount: 0, teams: [] };
        }

        // Bulk insert için entity'leri hazırla
        // originalId'yi metadata olarak sakla (frontend ID eşleştirmesi için)
        const teamEntities = teams.map((teamData, index) => {
          console.log(`📝 Team ${index + 1}:`, {
            name: teamData.name,
            membersCount: teamData.members?.length || 0,
            leadersCount: teamData.leaders?.length || 0,
            tableIdsCount: teamData.tableIds?.length || 0,
          });

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

        // Tek seferde kaydet
        const savedTeams = await teamRepo.save(teamEntities);
        console.log("✅ Ekipler kaydedildi:", savedTeams.length);

        // Frontend ID -> Backend ID eşleştirmesi için döndür
        const teamMapping = savedTeams.map((saved, index) => ({
          id: saved.id,
          name: saved.name,
          originalId: teams[index].id, // Frontend'den gelen orijinal ID
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
    // NOT: Sadece geçerli UUID formatındaki teamId'ler için sync yap
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(teamId)) {
      await this.syncStaffTeamIdByTableGroup(
        group.eventId,
        group.tableIds,
        teamId
      );
    }

    return this.tableGroupRepository.save(group);
  }

  // Masa grubundaki masalara atanmış personellerin teamId'sini güncelle
  private async syncStaffTeamIdByTableGroup(
    eventId: string,
    tableIds: string[],
    teamId: string
  ): Promise<void> {
    if (!tableIds || tableIds.length === 0) return;

    // UUID validasyonu - sadece geçerli UUID'ler kabul edilir
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(teamId)) {
      // Geçersiz UUID - sync yapma, sessizce çık
      return;
    }

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
  // Transaction ile atomik işlem - veri kaybı önlenir
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
    console.log(
      "📦 saveEventTableGroups çağrıldı:",
      JSON.stringify({ eventId, groupCount: groups?.length }, null, 2)
    );

    // Input validasyonu
    if (!eventId) {
      throw new BadRequestException("eventId gerekli");
    }

    if (!groups || !Array.isArray(groups)) {
      console.log(
        "⚠️ groups undefined veya array değil, boş array olarak işleniyor"
      );
      return { success: true, savedCount: 0 };
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const tableGroupRepo = manager.getRepository(TableGroup);
        const eventStaffRepo = manager.getRepository(EventStaffAssignment);

        // UUID regex - geçerli UUID kontrolü için
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // Mevcut grupları sil
        await tableGroupRepo.delete({ eventId });
        console.log("🗑️ Mevcut gruplar silindi");

        if (groups.length === 0) {
          return { success: true, savedCount: 0 };
        }

        // Bulk insert için entity'leri hazırla
        const groupEntities: TableGroup[] = groups.map((groupData, i) => {
          // Null/undefined kontrolü
          const safeTableIds = Array.isArray(groupData.tableIds)
            ? groupData.tableIds
            : [];
          const safeName = groupData.name || `Grup ${i + 1}`;
          const safeColor = groupData.color || "#3b82f6";

          // assignedTeamId UUID değilse null yap
          const validTeamId =
            groupData.assignedTeamId && uuidRegex.test(groupData.assignedTeamId)
              ? groupData.assignedTeamId
              : null;

          // assignedSupervisorId UUID değilse null yap
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

        console.log("📝 Entity'ler hazırlandı:", groupEntities.length);

        // Tek seferde kaydet
        await tableGroupRepo.save(groupEntities);
        console.log("✅ Gruplar kaydedildi");

        // NOT: EventStaffAssignment.teamId güncelleme kaldırıldı
        // Çünkü saveEventTeams yeni ID'ler oluşturuyor ve eski ID'ler geçersiz oluyor
        // Takım bilgisi table_groups.assignedTeamId ve service_teams'de tutuluyor

        return { success: true, savedCount: groupEntities.length };
      });
    } catch (error) {
      console.error("❌ saveEventTableGroups error:", error);
      console.error("❌ Error stack:", error.stack);
      console.error("❌ Groups data:", JSON.stringify(groups, null, 2));
      throw error;
    }
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

  // Tüm çalışma saatlerini getir (global + etkinliğe özel)
  async getAllShifts(eventId?: string): Promise<WorkShift[]> {
    if (eventId) {
      // Etkinlik varsa: global (eventId null) + bu etkinliğe özel olanları getir
      return this.workShiftRepository.find({
        where: [
          { isActive: true, eventId: IsNull() },
          { isActive: true, eventId },
        ],
        order: { sortOrder: "ASC", startTime: "ASC" },
      });
    }

    // Etkinlik yoksa sadece global olanları getir
    return this.workShiftRepository.find({
      where: { isActive: true, eventId: IsNull() },
      order: { sortOrder: "ASC", startTime: "ASC" },
    });
  }

  // Sadece etkinliğe özel vardiyaları getir
  async getEventShifts(eventId: string): Promise<WorkShift[]> {
    return this.workShiftRepository.find({
      where: { isActive: true, eventId },
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

  // Yeni çalışma saati oluştur (global veya etkinliğe özel)
  async createShift(dto: {
    name: string;
    startTime: string;
    endTime: string;
    color?: string;
    eventId?: string;
  }): Promise<WorkShift> {
    // Aynı isimde var mı kontrol et (aynı scope içinde)
    const existing = await this.workShiftRepository.findOne({
      where: {
        name: dto.name,
        isActive: true,
        eventId: dto.eventId ? dto.eventId : IsNull(),
      },
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
      eventId: dto.eventId ?? null,
    });

    return this.workShiftRepository.save(shift);
  }

  // Toplu vardiya oluştur (etkinlik için)
  async createBulkShifts(
    eventId: string,
    shifts: Array<{
      name: string;
      startTime: string;
      endTime: string;
      color?: string;
    }>
  ): Promise<WorkShift[]> {
    const createdShifts: WorkShift[] = [];

    for (let i = 0; i < shifts.length; i++) {
      const dto = shifts[i];
      const shift = this.workShiftRepository.create({
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        color: dto.color || "#3b82f6",
        sortOrder: i + 1,
        eventId,
      });
      createdShifts.push(shift);
    }

    return this.workShiftRepository.save(createdShifts);
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
        where: {
          name: dto.name,
          isActive: true,
          eventId: shift.eventId ? shift.eventId : IsNull(),
        },
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
   * Tüm ekipleri getir - HIZLI VERSİYON
   * Sadece temel bilgiler + memberIds'den üyeler
   */
  async getAllTeams(): Promise<any[]> {
    // 1. Tüm ekipleri getir (relation yok - hızlı)
    const teams = await this.teamRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", name: "ASC" },
    });

    if (teams.length === 0) return [];

    // 2. Tüm memberIds'leri topla
    const allMemberIds = new Set<string>();
    teams.forEach((team) => {
      if (team.leaderId) allMemberIds.add(team.leaderId);
      team.memberIds?.forEach((id) => allMemberIds.add(id));
    });

    // 3. Tüm personeli tek sorguda getir (Staff tablosundan)
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

    // 4. Memory'de join yap
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

  // ID ile ekip getir - OPTİMİZE: Relation kaldırıldı (leader bilgisi memberIds'den alınıyor)
  async getTeamById(id: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id },
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

  // Ekip liderini ata/değiştir - HIZLI VERSİYON (tek query)
  async setTeamLeader(teamId: string, leaderId: string | null): Promise<Team> {
    // leaderId null ise, raw query ile NULL set et
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

    // Güncel ekibi döndür
    return this.getTeamById(teamId);
  }

  // Ekip sil (soft delete)
  async deleteTeam(id: string): Promise<{ success: boolean; message: string }> {
    const team = await this.getTeamById(id);
    team.isActive = false;
    await this.teamRepository.save(team);
    return { success: true, message: "Ekip silindi" };
  }

  // Toplu ekip sil (soft delete) - OPTİMİZE: Tek query ile
  async bulkDeleteTeams(
    teamIds: string[]
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    if (!teamIds || teamIds.length === 0) {
      throw new BadRequestException("Silinecek ekip seçilmedi");
    }

    // Tek query ile tüm ekipleri soft delete yap
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

  // Ekibe üye ekle
  async addMemberToTeam(teamId: string, memberId: string): Promise<Team> {
    const team = await this.getTeamById(teamId);
    if (!team.memberIds.includes(memberId)) {
      team.memberIds.push(memberId);
      await this.teamRepository.save(team);
    }
    return team;
  }

  // Ekibe toplu üye ekle
  async addMembersToTeamBulk(
    teamId: string,
    memberIds: string[]
  ): Promise<Team> {
    const team = await this.getTeamById(teamId);
    const newMemberIds = memberIds.filter((id) => !team.memberIds.includes(id));
    if (newMemberIds.length > 0) {
      team.memberIds = [...team.memberIds, ...newMemberIds];
      await this.teamRepository.save(team);
    }
    return this.getTeamById(teamId); // Güncel veriyi döndür
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
    // Staff relation nullable olduğu için raw query ile daha güvenli
    const assignments = await this.eventStaffAssignmentRepository.find({
      where: { eventId, isActive: true },
      order: { sortOrder: "ASC" },
    });

    // Staff bilgilerini ayrı çek (Staff tablosundan)
    const staffIds = [
      ...new Set(assignments.map((a) => a.staffId).filter(Boolean)),
    ];

    let staffMap = new Map<
      string,
      { id: string; fullName: string; position: string }
    >();

    if (staffIds.length > 0) {
      // Önce Staff tablosundan dene
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

      // Staff'ta bulunamayanları User tablosundan dene
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

    // Assignment'lara staff bilgisi ekle
    return assignments.map((a) => {
      const staffInfo = staffMap.get(a.staffId);
      return {
        ...a,
        staff: staffInfo || null,
        staffName: staffInfo?.fullName || "Bilinmeyen",
      } as EventStaffAssignment & { staffName: string };
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
    // Personel kontrolü - Staff tablosundan ara
    const staff = await this.staffRepository.findOne({
      where: { id: dto.staffId },
    });
    if (!staff) {
      // User tablosundan da dene (eski veriler için)
      const user = await this.userRepository.findOne({
        where: { id: dto.staffId, role: UserRole.STAFF },
      });
      if (!user) {
        throw new NotFoundException("Personel bulunamadı");
      }
    }

    // Özel görev ise her zaman yeni atama oluştur
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
        color: dto.color || staff?.color,
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
    try {
      // Önce mevcut atamaları deaktif et
      await this.eventStaffAssignmentRepository.update(
        { eventId, isActive: true },
        { isActive: false }
      );

      // UUID regex pattern - sadece geçerli UUID'leri kabul et
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Yeni atamaları kaydet
      let savedCount = 0;
      for (const item of assignments) {
        if (item.tableIds.length === 0) continue;

        // Staff tablosundan personel bilgisini al
        let staffColor = item.color;
        if (!staffColor) {
          const staff = await this.staffRepository.findOne({
            where: { id: item.staffId },
            select: ["id", "color"],
          });
          staffColor = staff?.color;
        }

        // teamId sadece geçerli UUID ise kullan, değilse null
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
    } catch (error) {
      console.error("❌ saveEventStaffAssignments error:", error);
      throw error;
    }
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
      relations: ["staff"],
    });

    const tableGroups = await this.tableGroupRepository.find({
      where: { eventId: dto.eventId },
    });

    // Service teams'i al (takım adlarını almak için)
    const serviceTeams = await this.serviceTeamRepository.find({
      where: { eventId: dto.eventId },
    });
    const teamMap = new Map(serviceTeams.map((t) => [t.id, t]));

    // Süpervizörleri al (adlarını almak için)
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
          staffName: a.staff?.fullName, // Personel adını kaydet
          tableIds: a.tableIds,
          shiftId: a.shiftId,
          teamId: a.teamId,
          teamName: team?.name, // Takım adını kaydet
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
          assignedTeamName: team?.name, // Takım adını kaydet
          assignedSupervisorId: g.assignedSupervisorId,
          assignedSupervisorName: g.assignedSupervisorId
            ? supervisorMap.get(g.assignedSupervisorId)
            : undefined, // Süpervizör adını kaydet
        };
      }),
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
    await this.serviceTeamRepository.delete({ eventId });

    // Takım adı -> yeni takım ID eşleştirmesi için map
    const teamNameToIdMap = new Map<string, string>();

    // Önce şablondaki takımları oluştur (masa gruplarından unique takım adlarını çıkar)
    const uniqueTeamNames = new Set<string>();
    const teamColorMap = new Map<string, string>();

    for (const group of template.tableGroups) {
      if (group.assignedTeamName) {
        uniqueTeamNames.add(group.assignedTeamName);
        teamColorMap.set(group.assignedTeamName, group.color);
      }
    }

    // Her unique takım için yeni service_team oluştur
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

    // Personel adı -> ID eşleştirmesi için tüm aktif personeli al
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

    // Personel atamalarını uygula
    for (const assignment of template.staffAssignments) {
      // Önce staffId ile dene, yoksa staffName ile eşleştir
      let staff = await this.userRepository.findOne({
        where: { id: assignment.staffId, isActive: true },
      });

      // staffId ile bulunamadıysa, staffName ile eşleştir
      if (!staff && assignment.staffName) {
        const matchedStaff = staffNameToIdMap.get(
          assignment.staffName.toLowerCase()
        );
        if (matchedStaff) {
          staff = await this.userRepository.findOne({
            where: { id: matchedStaff.id, isActive: true },
          });
        }
      }

      if (!staff) continue;

      // teamId'yi teamName'e göre eşleştir
      let newTeamId: string | undefined;
      if (assignment.teamName) {
        newTeamId = teamNameToIdMap.get(assignment.teamName);
      }

      const newAssignment = this.eventStaffAssignmentRepository.create({
        eventId,
        staffId: staff.id,
        tableIds: assignment.tableIds,
        shiftId: assignment.shiftId,
        teamId: newTeamId, // Yeni oluşturulan takımın ID'si
        color: assignment.color || staff.color,
        isActive: true,
      });
      await this.eventStaffAssignmentRepository.save(newAssignment);
    }

    // Masa gruplarını uygula
    for (const group of template.tableGroups) {
      // assignedTeamId'yi teamName'e göre eşleştir
      let newAssignedTeamId: string | undefined;
      if (group.assignedTeamName) {
        newAssignedTeamId = teamNameToIdMap.get(group.assignedTeamName);
      }

      // assignedSupervisorId'yi supervisorName'e göre eşleştir
      let newSupervisorId: string | undefined;
      if (group.assignedSupervisorName) {
        const matchedSupervisor = staffNameToIdMap.get(
          group.assignedSupervisorName.toLowerCase()
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
        assignedTeamId: newAssignedTeamId, // Yeni oluşturulan takımın ID'si
        assignedSupervisorId: newSupervisorId, // Eşleşen süpervizörün ID'si
      });
      const savedGroup = await this.tableGroupRepository.save(newGroup);

      // Service team'in tableIds'ini güncelle
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

  // ==================== YENİ STAFF ENTITY METODLARI ====================

  // Tüm personeli getir (yeni Staff tablosundan) - OPTİMİZE EDİLDİ
  async findAllPersonnel(filters?: {
    department?: string;
    workLocation?: string;
    position?: string;
    isActive?: boolean;
    status?: string;
  }): Promise<Staff[]> {
    const query = this.staffRepository
      .createQueryBuilder("staff")
      .select([
        "staff.id",
        "staff.sicilNo",
        "staff.fullName",
        "staff.email",
        "staff.phone",
        "staff.avatar",
        "staff.position",
        "staff.department",
        "staff.workLocation",
        "staff.mentor",
        "staff.color",
        "staff.gender",
        "staff.birthDate",
        "staff.age",
        "staff.bloodType",
        "staff.shoeSize",
        "staff.sockSize",
        "staff.hireDate",
        "staff.yearsAtCompany",
        "staff.isActive",
        "staff.status",
      ]);

    if (filters?.department) {
      query.andWhere("staff.department = :department", {
        department: filters.department,
      });
    }
    if (filters?.workLocation) {
      query.andWhere("staff.workLocation = :workLocation", {
        workLocation: filters.workLocation,
      });
    }
    if (filters?.position) {
      query.andWhere("staff.position ILIKE :position", {
        position: `%${filters.position}%`,
      });
    }
    if (filters?.isActive !== undefined) {
      query.andWhere("staff.isActive = :isActive", {
        isActive: filters.isActive,
      });
    }
    if (filters?.status) {
      query.andWhere("staff.status = :status", { status: filters.status });
    }

    return query.orderBy("staff.fullName", "ASC").getMany();
  }

  // Tek personel getir (sicil no veya ID ile)
  async getPersonnelById(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({ where: { id } });
    if (!staff) {
      throw new NotFoundException("Personel bulunamadı");
    }
    return staff;
  }

  async getPersonnelBySicilNo(sicilNo: string): Promise<Staff | null> {
    return this.staffRepository.findOne({ where: { sicilNo } });
  }

  // Yeni personel oluştur
  async createPersonnel(dto: Partial<Staff>): Promise<Staff> {
    // Sicil no kontrolü
    if (dto.sicilNo) {
      const existing = await this.staffRepository.findOne({
        where: { sicilNo: dto.sicilNo },
      });
      if (existing) {
        throw new BadRequestException("Bu sicil numarası zaten kullanılıyor");
      }
    }

    // Renk atanmamışsa otomatik ata
    if (!dto.color) {
      const staffCount = await this.staffRepository.count();
      dto.color =
        DEFAULT_STAFF_COLORS[staffCount % DEFAULT_STAFF_COLORS.length];
    }

    const staff = this.staffRepository.create(dto);
    return this.staffRepository.save(staff);
  }

  // Personel güncelle
  async updatePersonnel(id: string, dto: Partial<Staff>): Promise<Staff> {
    const staff = await this.getPersonnelById(id);

    // Sicil no değişiyorsa kontrol et
    if (dto.sicilNo && dto.sicilNo !== staff.sicilNo) {
      const existing = await this.staffRepository.findOne({
        where: { sicilNo: dto.sicilNo },
      });
      if (existing) {
        throw new BadRequestException("Bu sicil numarası zaten kullanılıyor");
      }
    }

    Object.assign(staff, dto);
    return this.staffRepository.save(staff);
  }

  // Personel sil (soft delete)
  async deletePersonnel(id: string): Promise<{ success: boolean }> {
    const staff = await this.getPersonnelById(id);
    staff.isActive = false;
    staff.status = StaffStatus.INACTIVE;
    await this.staffRepository.save(staff);
    return { success: true };
  }

  // Avatar güncelle
  async updatePersonnelAvatar(id: string, avatarPath: string): Promise<Staff> {
    const staff = await this.getPersonnelById(id);
    staff.avatar = avatarPath;
    return this.staffRepository.save(staff);
  }

  // ==================== CSV IMPORT ====================

  // CSV'den toplu personel import et
  async importPersonnelFromCSV(
    csvData: Array<Record<string, string>>
  ): Promise<{
    success: boolean;
    imported: number;
    updated: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    let imported = 0;
    let updated = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      try {
        const sicilNo = row["Sicil No"]?.trim();
        if (!sicilNo) {
          errors.push({ row: i + 1, error: "Sicil No boş" });
          continue;
        }

        // Mevcut personel var mı kontrol et
        let staff = await this.staffRepository.findOne({ where: { sicilNo } });
        const isNew = !staff;

        if (!staff) {
          staff = this.staffRepository.create({ sicilNo });
        }

        // Alanları map'le
        staff.fullName = row["İsim Soyisim"]?.trim() || staff.fullName;
        staff.position = row["Unvan"]?.trim() || staff.position;
        staff.department = row["Çalıştığı Bölüm"]?.trim() || staff.department;
        staff.mentor = row["Miçolar"]?.trim() || staff.mentor;
        staff.workLocation =
          row["Görev Yeri "]?.trim() ||
          row["Görev Yeri"]?.trim() ||
          staff.workLocation;
        staff.bloodType = row["Kan Grubu"]?.trim() || staff.bloodType;

        // Cinsiyet
        const genderStr = row["Cinsiyet"]?.trim()?.toLowerCase();
        if (genderStr === "erkek" || genderStr === "male") {
          staff.gender = Gender.MALE;
        } else if (genderStr === "kadın" || genderStr === "female") {
          staff.gender = Gender.FEMALE;
        }

        // Ayakkabı numarası
        const shoeSize = parseInt(
          row["Ayakkabı \nNumarası"]?.trim() ||
            row["Ayakkabı Numarası"]?.trim() ||
            "0",
          10
        );
        if (shoeSize > 0) staff.shoeSize = shoeSize;

        // Çorap bedeni
        staff.sockSize = row["Kadın Çorap Bedenleri"]?.trim() || staff.sockSize;

        // Tarihler - Türkçe format parse
        const birthDateStr =
          row["Doğum Tarihi\n(Ay-Gün-Yıl)"]?.trim() ||
          row["Doğum Tarihi"]?.trim();
        if (birthDateStr) {
          const parsedBirthDate = this.parseTurkishDate(birthDateStr);
          if (parsedBirthDate) staff.birthDate = parsedBirthDate;
        }

        const hireDateStr =
          row["İşe Giriş Tarihi\n(Ay-Gün-Yıl)"]?.trim() ||
          row["İşe Giriş Tarihi"]?.trim();
        if (hireDateStr) {
          const parsedHireDate = this.parseTurkishDate(hireDateStr);
          if (parsedHireDate) staff.hireDate = parsedHireDate;
        }

        const terminationDateStr = row["Ayrılma Tarihi"]?.trim();
        if (terminationDateStr) {
          const parsedTermDate = this.parseTurkishDate(terminationDateStr);
          if (parsedTermDate) staff.terminationDate = parsedTermDate;
        }

        staff.terminationReason =
          row["Ayrılma \nNedeni "]?.trim() ||
          row["Ayrılma Nedeni"]?.trim() ||
          staff.terminationReason;

        // Yaş ve kıdem
        const age = parseInt(row["Yaş"]?.trim() || "0", 10);
        if (age > 0) staff.age = age;

        const yearsAtCompany = parseInt(
          row["Şirkette \nGeçirdiği Yıl"]?.trim() ||
            row["Şirkette Geçirdiği Yıl"]?.trim() ||
            "0",
          10
        );
        if (yearsAtCompany >= 0) staff.yearsAtCompany = yearsAtCompany;

        // Durum
        const statusStr = row["Durum"]?.trim()?.toLowerCase();
        if (statusStr === "çalışıyor" || statusStr === "active") {
          staff.status = StaffStatus.ACTIVE;
          staff.isActive = true;
        } else if (statusStr === "ayrıldı" || statusStr === "terminated") {
          staff.status = StaffStatus.TERMINATED;
          staff.isActive = false;
        } else {
          staff.status = StaffStatus.INACTIVE;
          staff.isActive = false;
        }

        // Renk ata (yoksa)
        if (!staff.color) {
          const count = await this.staffRepository.count();
          staff.color =
            DEFAULT_STAFF_COLORS[count % DEFAULT_STAFF_COLORS.length];
        }

        await this.staffRepository.save(staff);

        if (isNew) {
          imported++;
        } else {
          updated++;
        }
      } catch (error: any) {
        errors.push({ row: i + 1, error: error.message || "Bilinmeyen hata" });
      }
    }

    return { success: true, imported, updated, errors };
  }

  // Türkçe tarih parse (örn: "16 Haziran 2024", "02 Mart 84")
  private parseTurkishDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    const turkishMonths: Record<string, number> = {
      ocak: 0,
      şubat: 1,
      mart: 2,
      nisan: 3,
      mayıs: 4,
      haziran: 5,
      temmuz: 6,
      ağustos: 7,
      eylül: 8,
      ekim: 9,
      kasım: 10,
      aralık: 11,
    };

    try {
      // "16 Haziran 2024" veya "02 Mart 84" formatı
      const parts = dateStr.toLowerCase().split(/\s+/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = turkishMonths[parts[1]];
        let year = parseInt(parts[2], 10);

        // 2 haneli yıl ise düzelt
        if (year < 100) {
          year = year > 50 ? 1900 + year : 2000 + year;
        }

        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
          return new Date(year, month, day);
        }
      }
    } catch {
      // Parse hatası
    }

    return null;
  }

  // Users tablosundan Staff tablosuna migration
  async migrateUsersToStaff(): Promise<{
    success: boolean;
    migrated: number;
    skipped: number;
  }> {
    // Users tablosundan role=staff veya role=leader olanları al
    const usersToMigrate = await this.userRepository.find({
      where: [{ role: UserRole.STAFF }, { role: UserRole.LEADER }],
    });

    let migrated = 0;
    let skipped = 0;

    for (const user of usersToMigrate) {
      // Zaten staff tablosunda var mı kontrol et (email ile)
      const existingStaff = await this.staffRepository.findOne({
        where: [
          { email: user.email },
          { sicilNo: user.id }, // Geçici olarak user.id'yi sicilNo olarak kullan
        ],
      });

      if (existingStaff) {
        skipped++;
        continue;
      }

      // Yeni staff oluştur
      const staff = this.staffRepository.create({
        sicilNo: user.id, // Geçici sicil no olarak user.id kullan
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        position: user.position || "garson",
        color: user.color,
        isActive: user.isActive,
        status: user.isActive ? StaffStatus.ACTIVE : StaffStatus.INACTIVE,
      });

      await this.staffRepository.save(staff);
      migrated++;
    }

    return { success: true, migrated, skipped };
  }

  // Personel istatistikleri
  async getPersonnelStats(): Promise<{
    total: number;
    active: number;
    byDepartment: Record<string, number>;
    byLocation: Record<string, number>;
    byPosition: Record<string, number>;
  }> {
    const total = await this.staffRepository.count();
    const active = await this.staffRepository.count({
      where: { isActive: true },
    });

    // Bölüm bazlı
    const byDepartmentRaw = await this.staffRepository
      .createQueryBuilder("staff")
      .select("staff.department", "department")
      .addSelect("COUNT(*)", "count")
      .where("staff.department IS NOT NULL")
      .groupBy("staff.department")
      .getRawMany();

    const byDepartment: Record<string, number> = {};
    byDepartmentRaw.forEach((r) => {
      byDepartment[r.department] = parseInt(r.count, 10);
    });

    // Lokasyon bazlı
    const byLocationRaw = await this.staffRepository
      .createQueryBuilder("staff")
      .select("staff.workLocation", "location")
      .addSelect("COUNT(*)", "count")
      .where("staff.workLocation IS NOT NULL")
      .groupBy("staff.workLocation")
      .getRawMany();

    const byLocation: Record<string, number> = {};
    byLocationRaw.forEach((r) => {
      byLocation[r.location] = parseInt(r.count, 10);
    });

    // Pozisyon bazlı
    const byPositionRaw = await this.staffRepository
      .createQueryBuilder("staff")
      .select("staff.position", "position")
      .addSelect("COUNT(*)", "count")
      .where("staff.position IS NOT NULL")
      .groupBy("staff.position")
      .getRawMany();

    const byPosition: Record<string, number> = {};
    byPositionRaw.forEach((r) => {
      byPosition[r.position] = parseInt(r.count, 10);
    });

    return { total, active, byDepartment, byLocation, byPosition };
  }

  // ==================== LAZY LOADING API ====================

  /**
   * Pozisyon bazlı özet - sadece pozisyon adı ve sayısı
   * GraphQL benzeri yaklaşım: İlk yüklemede sadece özet
   */
  async getPersonnelSummaryByPosition(): Promise<
    Array<{
      position: string;
      count: number;
      activeCount: number;
    }>
  > {
    const result = await this.staffRepository
      .createQueryBuilder("staff")
      .select("staff.position", "position")
      .addSelect("COUNT(*)", "count")
      .addSelect(
        "SUM(CASE WHEN staff.isActive = true THEN 1 ELSE 0 END)",
        "activeCount"
      )
      .where("staff.position IS NOT NULL")
      .groupBy("staff.position")
      .orderBy("count", "DESC")
      .getRawMany();

    return result.map((r) => ({
      position: r.position,
      count: parseInt(r.count, 10),
      activeCount: parseInt(r.activeCount, 10),
    }));
  }

  /**
   * Pozisyona göre personel listesi - lazy loading
   * Sadece tıklandığında yüklenir
   */
  async getPersonnelByPosition(position: string): Promise<Staff[]> {
    return this.staffRepository
      .createQueryBuilder("staff")
      .select([
        "staff.id",
        "staff.sicilNo",
        "staff.fullName",
        "staff.email",
        "staff.phone",
        "staff.avatar",
        "staff.position",
        "staff.department",
        "staff.workLocation",
        "staff.mentor",
        "staff.color",
        "staff.gender",
        "staff.birthDate",
        "staff.age",
        "staff.bloodType",
        "staff.shoeSize",
        "staff.sockSize",
        "staff.hireDate",
        "staff.yearsAtCompany",
        "staff.isActive",
        "staff.status",
      ])
      .where("staff.position = :position", { position })
      .orderBy("staff.fullName", "ASC")
      .getMany();
  }

  /**
   * Departman bazlı özet
   */
  async getPersonnelSummaryByDepartment(): Promise<
    Array<{
      department: string;
      count: number;
      activeCount: number;
      sortOrder: number;
    }>
  > {
    // Departman tablosundan sortOrder'ı da çekiyoruz
    const result = await this.staffRepository
      .createQueryBuilder("staff")
      .select("staff.department", "department")
      .addSelect("COUNT(*)", "count")
      .addSelect(
        "SUM(CASE WHEN staff.isActive = true THEN 1 ELSE 0 END)",
        "activeCount"
      )
      .addSelect(
        `COALESCE((SELECT d."sortOrder" FROM departments d WHERE d.name = staff.department), 999)`,
        "sortOrder"
      )
      .where("staff.department IS NOT NULL")
      .groupBy("staff.department")
      .orderBy('"sortOrder"', "ASC")
      .getRawMany();

    return result.map((r) => ({
      department: r.department,
      count: parseInt(r.count, 10),
      activeCount: parseInt(r.activeCount, 10),
      sortOrder: parseInt(r.sortOrder, 10),
    }));
  }

  /**
   * Departmana göre personel listesi
   */
  async getPersonnelByDepartment(department: string): Promise<Staff[]> {
    return this.staffRepository
      .createQueryBuilder("staff")
      .select([
        "staff.id",
        "staff.sicilNo",
        "staff.fullName",
        "staff.email",
        "staff.phone",
        "staff.avatar",
        "staff.position",
        "staff.department",
        "staff.workLocation",
        "staff.color",
        "staff.isActive",
        "staff.status",
      ])
      .where("staff.department = :department", { department })
      .orderBy("staff.fullName", "ASC")
      .getMany();
  }

  // ==================== POSITIONS ====================

  /**
   * Tüm unvanları getir
   */
  async getAllPositions(onlyActive = true): Promise<Position[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.positionRepository.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  /**
   * Yeni unvan ekle
   */
  async createPosition(data: {
    name: string;
    description?: string;
  }): Promise<Position> {
    const existing = await this.positionRepository.findOne({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException("Bu unvan zaten mevcut");
    }

    const maxSort = await this.positionRepository
      .createQueryBuilder("p")
      .select("MAX(p.sortOrder)", "max")
      .getRawOne();

    const position = this.positionRepository.create({
      ...data,
      sortOrder: (maxSort?.max || 0) + 1,
    });
    return this.positionRepository.save(position);
  }

  /**
   * Unvan güncelle
   */
  async updatePosition(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ): Promise<Position> {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException("Unvan bulunamadı");
    }

    if (data.name && data.name !== position.name) {
      const existing = await this.positionRepository.findOne({
        where: { name: data.name },
      });
      if (existing) {
        throw new BadRequestException("Bu unvan zaten mevcut");
      }
    }

    Object.assign(position, data);
    return this.positionRepository.save(position);
  }

  /**
   * Unvan sil
   */
  async deletePosition(id: string): Promise<void> {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException("Unvan bulunamadı");
    }

    // Bu unvanı kullanan personel var mı kontrol et
    const usageCount = await this.staffRepository.count({
      where: { position: position.name },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Bu unvan ${usageCount} personel tarafından kullanılıyor. Önce personellerin unvanını değiştirin.`
      );
    }

    await this.positionRepository.remove(position);
  }

  // ==================== DEPARTMENTS ====================

  /**
   * Tüm bölümleri getir
   */
  async getAllDepartments(onlyActive = true): Promise<Department[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.departmentRepository.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  /**
   * Yeni bölüm ekle
   */
  async createDepartment(data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<Department> {
    const existing = await this.departmentRepository.findOne({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException("Bu bölüm zaten mevcut");
    }

    const maxSort = await this.departmentRepository
      .createQueryBuilder("d")
      .select("MAX(d.sortOrder)", "max")
      .getRawOne();

    const department = this.departmentRepository.create({
      ...data,
      sortOrder: (maxSort?.max || 0) + 1,
    });
    return this.departmentRepository.save(department);
  }

  /**
   * Bölüm güncelle
   */
  async updateDepartment(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ): Promise<Department> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });
    if (!department) {
      throw new NotFoundException("Bölüm bulunamadı");
    }

    if (data.name && data.name !== department.name) {
      const existing = await this.departmentRepository.findOne({
        where: { name: data.name },
      });
      if (existing) {
        throw new BadRequestException("Bu bölüm zaten mevcut");
      }
    }

    Object.assign(department, data);
    return this.departmentRepository.save(department);
  }

  /**
   * Bölüm sil
   */
  async deleteDepartment(id: string): Promise<void> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });
    if (!department) {
      throw new NotFoundException("Bölüm bulunamadı");
    }

    // Bu bölümü kullanan personel var mı kontrol et
    const usageCount = await this.staffRepository.count({
      where: { department: department.name },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Bu bölüm ${usageCount} personel tarafından kullanılıyor. Önce personellerin bölümünü değiştirin.`
      );
    }

    await this.departmentRepository.remove(department);
  }

  // ==================== WORK LOCATIONS (GÖREV YERLERİ) ====================

  /**
   * Tüm görev yerlerini getir
   */
  async getAllWorkLocations(onlyActive = true): Promise<WorkLocation[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.workLocationRepository.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  /**
   * Yeni görev yeri ekle
   */
  async createWorkLocation(data: {
    name: string;
    description?: string;
    address?: string;
  }): Promise<WorkLocation> {
    const existing = await this.workLocationRepository.findOne({
      where: { name: data.name },
    });
    if (existing) {
      throw new BadRequestException("Bu görev yeri zaten mevcut");
    }

    const maxSort = await this.workLocationRepository
      .createQueryBuilder("w")
      .select("MAX(w.sortOrder)", "max")
      .getRawOne();

    const workLocation = this.workLocationRepository.create({
      ...data,
      sortOrder: (maxSort?.max || 0) + 1,
    });
    return this.workLocationRepository.save(workLocation);
  }

  /**
   * Görev yeri güncelle
   */
  async updateWorkLocation(
    id: string,
    data: {
      name?: string;
      description?: string;
      address?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ): Promise<WorkLocation> {
    const workLocation = await this.workLocationRepository.findOne({
      where: { id },
    });
    if (!workLocation) {
      throw new NotFoundException("Görev yeri bulunamadı");
    }

    if (data.name && data.name !== workLocation.name) {
      const existing = await this.workLocationRepository.findOne({
        where: { name: data.name },
      });
      if (existing) {
        throw new BadRequestException("Bu görev yeri zaten mevcut");
      }
    }

    Object.assign(workLocation, data);
    return this.workLocationRepository.save(workLocation);
  }

  /**
   * Görev yeri sil
   */
  async deleteWorkLocation(id: string): Promise<void> {
    const workLocation = await this.workLocationRepository.findOne({
      where: { id },
    });
    if (!workLocation) {
      throw new NotFoundException("Görev yeri bulunamadı");
    }

    // Bu görev yerini kullanan personel var mı kontrol et
    const usageCount = await this.staffRepository.count({
      where: { workLocation: workLocation.name },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Bu görev yeri ${usageCount} personel tarafından kullanılıyor. Önce personellerin görev yerini değiştirin.`
      );
    }

    await this.workLocationRepository.remove(workLocation);
  }

  // ==================== DEPARTMENT-POSITION İLİŞKİLERİ ====================

  /**
   * Departmana ait pozisyonları getir
   */
  async getPositionsByDepartment(departmentId: string): Promise<Position[]> {
    const relations = await this.departmentPositionRepository.find({
      where: { departmentId },
      relations: ["position"],
    });
    return relations.map((r) => r.position).filter((p) => p.isActive);
  }

  /**
   * Pozisyona ait departmanları getir
   */
  async getDepartmentsByPosition(positionId: string): Promise<Department[]> {
    const relations = await this.departmentPositionRepository.find({
      where: { positionId },
      relations: ["department"],
    });
    return relations.map((r) => r.department).filter((d) => d.isActive);
  }

  /**
   * Departman-Pozisyon ilişkisi ekle
   */
  async addPositionToDepartment(
    departmentId: string,
    positionId: string
  ): Promise<DepartmentPosition> {
    const existing = await this.departmentPositionRepository.findOne({
      where: { departmentId, positionId },
    });
    if (existing) {
      return existing;
    }

    const relation = this.departmentPositionRepository.create({
      departmentId,
      positionId,
    });
    return this.departmentPositionRepository.save(relation);
  }

  /**
   * Departman-Pozisyon ilişkisi kaldır
   */
  async removePositionFromDepartment(
    departmentId: string,
    positionId: string
  ): Promise<void> {
    await this.departmentPositionRepository.delete({
      departmentId,
      positionId,
    });
  }

  /**
   * Departmanın tüm pozisyon ilişkilerini güncelle
   */
  async updateDepartmentPositions(
    departmentId: string,
    positionIds: string[]
  ): Promise<void> {
    // Mevcut ilişkileri sil
    await this.departmentPositionRepository.delete({ departmentId });

    // Yeni ilişkileri ekle
    const relations = positionIds.map((positionId) =>
      this.departmentPositionRepository.create({ departmentId, positionId })
    );
    await this.departmentPositionRepository.save(relations);
  }

  // ==================== DEPARTMENT-LOCATION İLİŞKİLERİ ====================

  /**
   * Departmana ait görev yerlerini getir
   */
  async getLocationsByDepartment(
    departmentId: string
  ): Promise<WorkLocation[]> {
    const relations = await this.departmentLocationRepository.find({
      where: { departmentId },
      relations: ["workLocation"],
    });
    return relations.map((r) => r.workLocation).filter((l) => l.isActive);
  }

  /**
   * Görev yerine ait departmanları getir
   */
  async getDepartmentsByLocation(
    workLocationId: string
  ): Promise<Department[]> {
    const relations = await this.departmentLocationRepository.find({
      where: { workLocationId },
      relations: ["department"],
    });
    return relations.map((r) => r.department).filter((d) => d.isActive);
  }

  /**
   * Departman-Görev Yeri ilişkisi ekle
   */
  async addLocationToDepartment(
    departmentId: string,
    workLocationId: string
  ): Promise<DepartmentLocation> {
    const existing = await this.departmentLocationRepository.findOne({
      where: { departmentId, workLocationId },
    });
    if (existing) {
      return existing;
    }

    const relation = this.departmentLocationRepository.create({
      departmentId,
      workLocationId,
    });
    return this.departmentLocationRepository.save(relation);
  }

  /**
   * Departman-Görev Yeri ilişkisi kaldır
   */
  async removeLocationFromDepartment(
    departmentId: string,
    workLocationId: string
  ): Promise<void> {
    await this.departmentLocationRepository.delete({
      departmentId,
      workLocationId,
    });
  }

  /**
   * Departmanın tüm görev yeri ilişkilerini güncelle
   */
  async updateDepartmentLocations(
    departmentId: string,
    workLocationIds: string[]
  ): Promise<void> {
    // Mevcut ilişkileri sil
    await this.departmentLocationRepository.delete({ departmentId });

    // Yeni ilişkileri ekle
    const relations = workLocationIds.map((workLocationId) =>
      this.departmentLocationRepository.create({ departmentId, workLocationId })
    );
    await this.departmentLocationRepository.save(relations);
  }

  /**
   * Tüm ilişkileri Excel verilerinden oluştur
   */
  async syncRelationsFromStaffData(): Promise<{
    departmentPositions: number;
    departmentLocations: number;
  }> {
    // Mevcut ilişkileri temizle
    await this.departmentPositionRepository.clear();
    await this.departmentLocationRepository.clear();

    // Staff tablosundan unique ilişkileri çek
    const dpRelations = await this.staffRepository
      .createQueryBuilder("s")
      .select("d.id", "departmentId")
      .addSelect("p.id", "positionId")
      .innerJoin("departments", "d", "d.name = s.department")
      .innerJoin("positions", "p", "p.name = s.position")
      .where("s.department IS NOT NULL AND s.position IS NOT NULL")
      .distinct(true)
      .getRawMany();

    const dlRelations = await this.staffRepository
      .createQueryBuilder("s")
      .select("d.id", "departmentId")
      .addSelect("w.id", "workLocationId")
      .innerJoin("departments", "d", "d.name = s.department")
      .innerJoin("work_locations", "w", 'w.name = s."workLocation"')
      .where('s.department IS NOT NULL AND s."workLocation" IS NOT NULL')
      .distinct(true)
      .getRawMany();

    // İlişkileri kaydet
    if (dpRelations.length > 0) {
      await this.departmentPositionRepository.save(
        dpRelations.map((r) =>
          this.departmentPositionRepository.create({
            departmentId: r.departmentId,
            positionId: r.positionId,
          })
        )
      );
    }

    if (dlRelations.length > 0) {
      await this.departmentLocationRepository.save(
        dlRelations.map((r) =>
          this.departmentLocationRepository.create({
            departmentId: r.departmentId,
            workLocationId: r.workLocationId,
          })
        )
      );
    }

    return {
      departmentPositions: dpRelations.length,
      departmentLocations: dlRelations.length,
    };
  }

  /**
   * Departman detaylarını ilişkileriyle birlikte getir
   */
  async getDepartmentWithRelations(id: string): Promise<{
    department: Department;
    positions: Position[];
    locations: WorkLocation[];
  }> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });
    if (!department) {
      throw new NotFoundException("Bölüm bulunamadı");
    }

    const positions = await this.getPositionsByDepartment(id);
    const locations = await this.getLocationsByDepartment(id);

    return { department, positions, locations };
  }

  /**
   * Tüm departmanları ilişkileriyle birlikte getir
   */
  async getAllDepartmentsWithRelations(): Promise<
    Array<{
      department: Department;
      positions: Position[];
      locations: WorkLocation[];
      staffCount: number;
    }>
  > {
    const departments = await this.departmentRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC", name: "ASC" },
    });

    const result = await Promise.all(
      departments.map(async (department) => {
        const positions = await this.getPositionsByDepartment(department.id);
        const locations = await this.getLocationsByDepartment(department.id);
        const staffCount = await this.staffRepository.count({
          where: { department: department.name, isActive: true },
        });

        return { department, positions, locations, staffCount };
      })
    );

    return result;
  }
}
