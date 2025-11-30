import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StaffAssignment, User, Event, ServiceTeam } from "../../entities";
import { TeamMember } from "../../entities/service-team.entity";
import { UserRole, StaffPosition } from "../../entities/user.entity";
import * as bcrypt from "bcrypt";

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
    private teamRepository: Repository<ServiceTeam>
  ) {}

  // Personel listesi (role = 'staff')
  async findAllStaff(onlyActive = false): Promise<User[]> {
    const where: any = { role: UserRole.STAFF };
    if (onlyActive) {
      where.isActive = true;
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
      where: { id, role: UserRole.STAFF },
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
    position?: StaffPosition;
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
        where: { role: UserRole.STAFF },
      });
      color = DEFAULT_STAFF_COLORS[staffCount % DEFAULT_STAFF_COLORS.length];
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const staff = this.userRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      password: hashedPassword,
      phone: dto.phone,
      color,
      position: dto.position,
      avatar: dto.avatar,
      role: UserRole.STAFF,
      isActive: true,
    });

    const saved = await this.userRepository.save(staff);

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
      position?: StaffPosition;
      avatar?: string;
      isActive?: boolean;
    }
  ): Promise<User> {
    const staff = await this.userRepository.findOne({
      where: { id, role: UserRole.STAFF },
    });

    if (!staff) {
      throw new NotFoundException("Personel bulunamadı");
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
      where: { id, role: UserRole.STAFF },
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

    // Yeni atamaları kaydet
    let savedCount = 0;
    for (const item of assignments) {
      if (item.tableIds.length > 0) {
        const staff = await this.userRepository.findOne({
          where: { id: item.staffId },
        });

        const assignment = this.assignmentRepository.create({
          eventId,
          staffId: item.staffId,
          assignedTableIds: item.tableIds,
          color: item.color || staff?.color,
        });
        await this.assignmentRepository.save(assignment);
        savedCount++;
      }
    }

    return { success: true, savedCount };
  }

  // ==================== TEAM METODLARI ====================

  // Etkinlik için tüm ekipleri getir
  async getEventTeams(eventId: string): Promise<ServiceTeam[]> {
    return this.teamRepository.find({
      where: { eventId },
      order: { createdAt: "ASC" },
    });
  }

  // Tek ekip getir
  async getTeamById(teamId: string): Promise<ServiceTeam> {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return team;
  }

  // Yeni ekip oluştur
  async createTeam(dto: {
    eventId: string;
    name: string;
    color: string;
    members?: TeamMember[];
    leaderId?: string;
    tableIds?: string[];
  }): Promise<ServiceTeam> {
    const team = this.teamRepository.create({
      eventId: dto.eventId,
      name: dto.name,
      color: dto.color,
      members: dto.members || [],
      leaderId: dto.leaderId,
      tableIds: dto.tableIds || [],
    });
    return this.teamRepository.save(team);
  }

  // Ekip güncelle
  async updateTeam(
    teamId: string,
    dto: {
      name?: string;
      color?: string;
      members?: TeamMember[];
      leaderId?: string;
      tableIds?: string[];
    }
  ): Promise<ServiceTeam> {
    const team = await this.getTeamById(teamId);
    Object.assign(team, dto);
    return this.teamRepository.save(team);
  }

  // Ekip sil
  async deleteTeam(teamId: string): Promise<{ success: boolean }> {
    const result = await this.teamRepository.delete(teamId);
    if (result.affected === 0) {
      throw new NotFoundException("Ekip bulunamadı");
    }
    return { success: true };
  }

  // Ekibe üye ekle
  async addMemberToTeam(
    teamId: string,
    member: TeamMember
  ): Promise<ServiceTeam> {
    const team = await this.getTeamById(teamId);

    // Zaten ekipte mi kontrol et
    if (team.members.some((m) => m.id === member.id)) {
      throw new BadRequestException("Bu personel zaten ekipte");
    }

    team.members.push(member);
    return this.teamRepository.save(team);
  }

  // Ekipten üye çıkar
  async removeMemberFromTeam(
    teamId: string,
    memberId: string
  ): Promise<ServiceTeam> {
    const team = await this.getTeamById(teamId);
    team.members = team.members.filter((m) => m.id !== memberId);

    // Eğer çıkarılan kişi lider ise, liderliği kaldır
    if (team.leaderId === memberId) {
      team.leaderId = undefined;
    }

    return this.teamRepository.save(team);
  }

  // Ekibe masa ata
  async assignTablesToTeam(
    teamId: string,
    tableIds: string[]
  ): Promise<ServiceTeam> {
    const team = await this.getTeamById(teamId);

    // Aynı etkinlikteki diğer ekiplerden bu masaları kaldır
    const otherTeams = await this.teamRepository.find({
      where: { eventId: team.eventId },
    });

    for (const otherTeam of otherTeams) {
      if (otherTeam.id !== teamId) {
        const filteredTableIds = otherTeam.tableIds.filter(
          (id) => !tableIds.includes(id)
        );
        if (filteredTableIds.length !== otherTeam.tableIds.length) {
          otherTeam.tableIds = filteredTableIds;
          await this.teamRepository.save(otherTeam);
        }
      }
    }

    // Bu ekibe masaları ekle
    team.tableIds = [...new Set([...team.tableIds, ...tableIds])];
    return this.teamRepository.save(team);
  }

  // Ekipten masa kaldır
  async removeTablesFromTeam(
    teamId: string,
    tableIds: string[]
  ): Promise<ServiceTeam> {
    const team = await this.getTeamById(teamId);
    team.tableIds = team.tableIds.filter((id) => !tableIds.includes(id));
    return this.teamRepository.save(team);
  }

  // Tüm ekipleri toplu kaydet (frontend'den gelen tam liste)
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
    await this.teamRepository.delete({ eventId });

    // Yeni ekipleri kaydet
    let savedCount = 0;
    for (const teamData of teams) {
      const team = this.teamRepository.create({
        eventId,
        name: teamData.name,
        color: teamData.color,
        members: teamData.members,
        leaderId: teamData.leaderId,
        tableIds: teamData.tableIds,
      });
      await this.teamRepository.save(team);
      savedCount++;
    }

    return { success: true, savedCount };
  }
}
