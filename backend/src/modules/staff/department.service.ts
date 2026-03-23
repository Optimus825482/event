import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Position } from "../../entities/position.entity";
import { Department } from "../../entities/department.entity";
import { WorkLocation } from "../../entities/work-location.entity";
import { DepartmentPosition } from "../../entities/department-position.entity";
import { DepartmentLocation } from "../../entities/department-location.entity";
import { Staff } from "../../entities";

@Injectable()
export class DepartmentService {
  constructor(
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
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  // ==================== POSITIONS ====================

  async getAllPositions(onlyActive = true): Promise<Position[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.positionRepository.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

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

  async updatePosition(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
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

  async deletePosition(id: string): Promise<void> {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException("Unvan bulunamadı");
    }

    const usageCount = await this.staffRepository.count({
      where: { position: position.name },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Bu unvan ${usageCount} personel tarafından kullanılıyor. Önce personellerin unvanını değiştirin.`,
      );
    }

    await this.positionRepository.remove(position);
  }

  // ==================== DEPARTMENTS ====================

  async getAllDepartments(onlyActive = true): Promise<Department[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.departmentRepository.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

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

  async updateDepartment(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
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

  async deleteDepartment(id: string): Promise<void> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });
    if (!department) {
      throw new NotFoundException("Bölüm bulunamadı");
    }

    const usageCount = await this.staffRepository.count({
      where: { department: department.name },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Bu bölüm ${usageCount} personel tarafından kullanılıyor. Önce personellerin bölümünü değiştirin.`,
      );
    }

    await this.departmentRepository.remove(department);
  }

  // ==================== WORK LOCATIONS ====================

  async getAllWorkLocations(onlyActive = true): Promise<WorkLocation[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.workLocationRepository.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

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

  async updateWorkLocation(
    id: string,
    data: {
      name?: string;
      description?: string;
      address?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
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

  async deleteWorkLocation(id: string): Promise<void> {
    const workLocation = await this.workLocationRepository.findOne({
      where: { id },
    });
    if (!workLocation) {
      throw new NotFoundException("Görev yeri bulunamadı");
    }

    const usageCount = await this.staffRepository.count({
      where: { workLocation: workLocation.name },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Bu görev yeri ${usageCount} personel tarafından kullanılıyor. Önce personellerin görev yerini değiştirin.`,
      );
    }

    await this.workLocationRepository.remove(workLocation);
  }

  // ==================== DEPARTMENT-POSITION RELATIONS ====================

  async getPositionsByDepartment(departmentId: string): Promise<Position[]> {
    const relations = await this.departmentPositionRepository.find({
      where: { departmentId },
      relations: ["position"],
    });
    return relations.map((r) => r.position).filter((p) => p.isActive);
  }

  async getDepartmentsByPosition(positionId: string): Promise<Department[]> {
    const relations = await this.departmentPositionRepository.find({
      where: { positionId },
      relations: ["department"],
    });
    return relations.map((r) => r.department).filter((d) => d.isActive);
  }

  async addPositionToDepartment(
    departmentId: string,
    positionId: string,
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

  async removePositionFromDepartment(
    departmentId: string,
    positionId: string,
  ): Promise<void> {
    await this.departmentPositionRepository.delete({
      departmentId,
      positionId,
    });
  }

  async updateDepartmentPositions(
    departmentId: string,
    positionIds: string[],
  ): Promise<void> {
    await this.departmentPositionRepository.delete({ departmentId });

    const relations = positionIds.map((positionId) =>
      this.departmentPositionRepository.create({ departmentId, positionId }),
    );
    await this.departmentPositionRepository.save(relations);
  }

  // ==================== DEPARTMENT-LOCATION RELATIONS ====================

  async getLocationsByDepartment(
    departmentId: string,
  ): Promise<WorkLocation[]> {
    const relations = await this.departmentLocationRepository.find({
      where: { departmentId },
      relations: ["workLocation"],
    });
    return relations.map((r) => r.workLocation).filter((l) => l.isActive);
  }

  async getDepartmentsByLocation(
    workLocationId: string,
  ): Promise<Department[]> {
    const relations = await this.departmentLocationRepository.find({
      where: { workLocationId },
      relations: ["department"],
    });
    return relations.map((r) => r.department).filter((d) => d.isActive);
  }

  async addLocationToDepartment(
    departmentId: string,
    workLocationId: string,
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

  async removeLocationFromDepartment(
    departmentId: string,
    workLocationId: string,
  ): Promise<void> {
    await this.departmentLocationRepository.delete({
      departmentId,
      workLocationId,
    });
  }

  async updateDepartmentLocations(
    departmentId: string,
    workLocationIds: string[],
  ): Promise<void> {
    await this.departmentLocationRepository.delete({ departmentId });

    const relations = workLocationIds.map((workLocationId) =>
      this.departmentLocationRepository.create({
        departmentId,
        workLocationId,
      }),
    );
    await this.departmentLocationRepository.save(relations);
  }

  // ==================== SYNC & AGGREGATION ====================

  async syncRelationsFromStaffData(): Promise<{
    departmentPositions: number;
    departmentLocations: number;
  }> {
    await this.departmentPositionRepository.clear();
    await this.departmentLocationRepository.clear();

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

    if (dpRelations.length > 0) {
      await this.departmentPositionRepository.save(
        dpRelations.map((r) =>
          this.departmentPositionRepository.create({
            departmentId: r.departmentId,
            positionId: r.positionId,
          }),
        ),
      );
    }

    if (dlRelations.length > 0) {
      await this.departmentLocationRepository.save(
        dlRelations.map((r) =>
          this.departmentLocationRepository.create({
            departmentId: r.departmentId,
            workLocationId: r.workLocationId,
          }),
        ),
      );
    }

    return {
      departmentPositions: dpRelations.length,
      departmentLocations: dlRelations.length,
    };
  }

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
      }),
    );

    return result;
  }
}
