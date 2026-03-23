import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, Staff } from "../../entities";
import { Gender, StaffStatus } from "../../entities/staff.entity";
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
export class StaffCrudService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // ==================== USER-BASED STAFF CRUD ====================

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

  async createStaff(dto: {
    email: string;
    fullName: string;
    password: string;
    phone?: string;
    color?: string;
    position?: string;
    avatar?: string;
  }): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException("Bu email adresi zaten kullanılıyor");
    }

    let color = dto.color;
    if (!color) {
      const staffCount = await this.userRepository.count({
        where: [{ role: UserRole.STAFF }, { role: UserRole.LEADER }],
      });
      color = DEFAULT_STAFF_COLORS[staffCount % DEFAULT_STAFF_COLORS.length];
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

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

    try {
      await this.notificationsService.notifyNewStaffAdded(
        saved.fullName,
        saved.position || "Personel",
        "",
      );
    } catch {
      // Bildirim hatası ana işlemi etkilemesin
    }

    const { password, ...result } = saved;
    return result as User;
  }

  async updateStaff(
    id: string,
    dto: {
      fullName?: string;
      phone?: string;
      color?: string;
      position?: string;
      avatar?: string;
      isActive?: boolean;
    },
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

  async deactivateStaff(
    id: string,
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

  // ==================== STAFF ENTITY CRUD ====================

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

  async createPersonnel(dto: Partial<Staff>): Promise<Staff> {
    if (dto.sicilNo) {
      const existing = await this.staffRepository.findOne({
        where: { sicilNo: dto.sicilNo },
      });
      if (existing) {
        throw new BadRequestException("Bu sicil numarası zaten kullanılıyor");
      }
    }

    if (!dto.color) {
      const staffCount = await this.staffRepository.count();
      dto.color =
        DEFAULT_STAFF_COLORS[staffCount % DEFAULT_STAFF_COLORS.length];
    }

    const staff = this.staffRepository.create(dto);
    return this.staffRepository.save(staff);
  }

  async updatePersonnel(id: string, dto: Partial<Staff>): Promise<Staff> {
    const staff = await this.getPersonnelById(id);

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

  async deletePersonnel(id: string): Promise<{ success: boolean }> {
    const staff = await this.getPersonnelById(id);
    staff.isActive = false;
    staff.status = StaffStatus.INACTIVE;
    await this.staffRepository.save(staff);
    return { success: true };
  }

  async updatePersonnelAvatar(id: string, avatarPath: string): Promise<Staff> {
    const staff = await this.getPersonnelById(id);
    staff.avatar = avatarPath;
    return this.staffRepository.save(staff);
  }

  // ==================== CSV IMPORT ====================

  async importPersonnelFromCSV(
    csvData: Array<Record<string, string>>,
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

        let staff = await this.staffRepository.findOne({ where: { sicilNo } });
        const isNew = !staff;

        if (!staff) {
          staff = this.staffRepository.create({ sicilNo });
        }

        staff.fullName = row["İsim Soyisim"]?.trim() || staff.fullName;
        staff.position = row["Unvan"]?.trim() || staff.position;
        staff.department = row["Çalıştığı Bölüm"]?.trim() || staff.department;
        staff.mentor = row["Miçolar"]?.trim() || staff.mentor;
        staff.workLocation =
          row["Görev Yeri "]?.trim() ||
          row["Görev Yeri"]?.trim() ||
          staff.workLocation;
        staff.bloodType = row["Kan Grubu"]?.trim() || staff.bloodType;

        const genderStr = row["Cinsiyet"]?.trim()?.toLowerCase();
        if (genderStr === "erkek" || genderStr === "male") {
          staff.gender = Gender.MALE;
        } else if (genderStr === "kadın" || genderStr === "female") {
          staff.gender = Gender.FEMALE;
        }

        const shoeSize = parseInt(
          row["Ayakkabı \nNumarası"]?.trim() ||
            row["Ayakkabı Numarası"]?.trim() ||
            "0",
          10,
        );
        if (shoeSize > 0) staff.shoeSize = shoeSize;

        staff.sockSize = row["Kadın Çorap Bedenleri"]?.trim() || staff.sockSize;

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

        const ageFromExcel = parseInt(row["Yaş"]?.trim() || "0", 10);
        if (ageFromExcel > 0 && !staff.birthDate) {
          const approxBirthYear = new Date().getFullYear() - ageFromExcel;
          staff.birthDate = new Date(approxBirthYear, 0, 1);
        }

        const yearsAtCompany = parseInt(
          row["Şirkette \nGeçirdiği Yıl"]?.trim() ||
            row["Şirkette Geçirdiği Yıl"]?.trim() ||
            "0",
          10,
        );
        if (yearsAtCompany >= 0) staff.yearsAtCompany = yearsAtCompany;

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
      const parts = dateStr.toLowerCase().split(/\s+/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = turkishMonths[parts[1]];
        let year = parseInt(parts[2], 10);

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

  // ==================== MIGRATION & STATS ====================

  async migrateUsersToStaff(): Promise<{
    success: boolean;
    migrated: number;
    skipped: number;
  }> {
    const usersToMigrate = await this.userRepository.find({
      where: [{ role: UserRole.STAFF }, { role: UserRole.LEADER }],
    });

    let migrated = 0;
    let skipped = 0;

    for (const user of usersToMigrate) {
      const existingStaff = await this.staffRepository.findOne({
        where: [{ email: user.email }, { sicilNo: user.id }],
      });

      if (existingStaff) {
        skipped++;
        continue;
      }

      const staff = this.staffRepository.create({
        sicilNo: user.id,
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
        "activeCount",
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

  async getPersonnelByPosition(position: string): Promise<Staff[]> {
    return this.staffRepository
      .createQueryBuilder("staff")
      .select([
        "staff.id",
        "staff.sicilNo",
        "staff.fullName",
        "staff.email",
        "staff.phone",
        "staff.position",
        "staff.department",
        "staff.workLocation",
        "staff.mentor",
        "staff.color",
        "staff.gender",
        "staff.birthDate",
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

  async getPersonnelSummaryByDepartment(): Promise<
    Array<{
      department: string;
      count: number;
      activeCount: number;
      sortOrder: number;
    }>
  > {
    const result = await this.staffRepository
      .createQueryBuilder("staff")
      .select("staff.department", "department")
      .addSelect("COUNT(*)", "count")
      .addSelect(
        "SUM(CASE WHEN staff.isActive = true THEN 1 ELSE 0 END)",
        "activeCount",
      )
      .addSelect(
        `COALESCE((SELECT d."sortOrder" FROM departments d WHERE d.name = staff.department), 999)`,
        "sortOrder",
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

  async getPersonnelByDepartment(department: string): Promise<Staff[]> {
    return this.staffRepository
      .createQueryBuilder("staff")
      .select([
        "staff.id",
        "staff.sicilNo",
        "staff.fullName",
        "staff.email",
        "staff.phone",
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
}
