import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { StaffRole, WorkShift, User } from "../../entities";
import { UserRole } from "../../entities/user.entity";

@Injectable()
export class StaffConfigService {
  constructor(
    @InjectRepository(StaffRole)
    private staffRoleRepository: Repository<StaffRole>,
    @InjectRepository(WorkShift)
    private workShiftRepository: Repository<WorkShift>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // ==================== STAFF ROLE METHODS ====================

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

  async getAllRoles(): Promise<StaffRole[]> {
    const roles = await this.staffRoleRepository.find({
      where: { isActive: true },
      order: { sortOrder: "ASC" },
    });

    if (roles.length === 0) {
      return this.seedDefaultRoles();
    }

    return roles;
  }

  async getRoleById(id: string): Promise<StaffRole> {
    const role = await this.staffRoleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException("Rol bulunamadı");
    }
    return role;
  }

  async getRoleByKey(key: string): Promise<StaffRole | null> {
    return this.staffRoleRepository.findOne({ where: { key } });
  }

  async createRole(dto: {
    key: string;
    label: string;
    color: string;
    badgeColor?: string;
    bgColor?: string;
  }): Promise<StaffRole> {
    const existing = await this.staffRoleRepository.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new BadRequestException("Bu key ile bir rol zaten var");
    }

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

  async updateRole(
    id: string,
    dto: {
      label?: string;
      color?: string;
      badgeColor?: string;
      bgColor?: string;
      sortOrder?: number;
    },
  ): Promise<StaffRole> {
    const role = await this.getRoleById(id);

    if (dto.color && !dto.badgeColor) {
      dto.badgeColor = this.generateBadgeColor(dto.color);
    }

    Object.assign(role, dto);
    return this.staffRoleRepository.save(role);
  }

  async deleteRole(id: string): Promise<{ success: boolean; message: string }> {
    const role = await this.getRoleById(id);

    const staffCount = await this.userRepository.count({
      where: { role: UserRole.STAFF, position: role.key as any },
    });

    if (staffCount > 0) {
      throw new BadRequestException(
        `Bu rolde ${staffCount} personel var. Önce personellerin rolünü değiştirin.`,
      );
    }

    role.isActive = false;
    await this.staffRoleRepository.save(role);

    return { success: true, message: "Rol silindi" };
  }

  async hardDeleteRole(id: string): Promise<{ success: boolean }> {
    const role = await this.getRoleById(id);

    const staffCount = await this.userRepository.count({
      where: { role: UserRole.STAFF, position: role.key as any },
    });

    if (staffCount > 0) {
      throw new BadRequestException(
        `Bu rolde ${staffCount} personel var. Önce personellerin rolünü değiştirin.`,
      );
    }

    await this.staffRoleRepository.delete(id);
    return { success: true };
  }

  private generateBadgeColor(hexColor: string): string {
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

  // ==================== WORK SHIFT METHODS ====================

  async getAllShifts(eventId?: string): Promise<WorkShift[]> {
    if (eventId) {
      return this.workShiftRepository.find({
        where: [
          { isActive: true, eventId: IsNull() },
          { isActive: true, eventId },
        ],
        order: { sortOrder: "ASC", startTime: "ASC" },
      });
    }

    return this.workShiftRepository.find({
      where: { isActive: true, eventId: IsNull() },
      order: { sortOrder: "ASC", startTime: "ASC" },
    });
  }

  async getEventShifts(eventId: string): Promise<WorkShift[]> {
    return this.workShiftRepository.find({
      where: { isActive: true, eventId },
      order: { sortOrder: "ASC", startTime: "ASC" },
    });
  }

  async getShiftById(id: string): Promise<WorkShift> {
    const shift = await this.workShiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new NotFoundException("Çalışma saati bulunamadı");
    }
    return shift;
  }

  async createShift(dto: {
    name: string;
    startTime: string;
    endTime: string;
    color?: string;
    eventId?: string;
  }): Promise<WorkShift> {
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

  async createBulkShifts(
    eventId: string,
    shifts: Array<{
      name: string;
      startTime: string;
      endTime: string;
      color?: string;
    }>,
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

  async updateShift(
    id: string,
    dto: {
      name?: string;
      startTime?: string;
      endTime?: string;
      color?: string;
      sortOrder?: number;
    },
  ): Promise<WorkShift> {
    const shift = await this.getShiftById(id);

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

  async deleteShift(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const shift = await this.getShiftById(id);
    shift.isActive = false;
    await this.workShiftRepository.save(shift);
    return { success: true, message: "Çalışma saati silindi" };
  }
}
