import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServicePoint } from "../../entities/service-point.entity";
import { ServicePointStaffAssignment } from "../../entities/service-point-staff-assignment.entity";
import {
  CreateServicePointDto,
  UpdateServicePointDto,
  CreateServicePointStaffAssignmentDto,
  UpdateServicePointStaffAssignmentDto,
} from "./dto/service-point.dto";

@Injectable()
export class ServicePointsService {
  constructor(
    @InjectRepository(ServicePoint)
    private servicePointRepository: Repository<ServicePoint>,
    @InjectRepository(ServicePointStaffAssignment)
    private assignmentRepository: Repository<ServicePointStaffAssignment>
  ) {}

  // ==================== SERVICE POINTS ====================

  /**
   * Etkinliğe ait tüm hizmet noktalarını getir
   */
  async findAllByEvent(eventId: string): Promise<ServicePoint[]> {
    return this.servicePointRepository.find({
      where: { eventId, isActive: true },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * Tek bir hizmet noktasını getir
   */
  async findOne(id: string): Promise<ServicePoint> {
    const servicePoint = await this.servicePointRepository.findOne({
      where: { id },
    });
    if (!servicePoint) {
      throw new NotFoundException("Hizmet noktası bulunamadı");
    }
    return servicePoint;
  }

  /**
   * Yeni hizmet noktası oluştur
   */
  async create(
    eventId: string,
    dto: CreateServicePointDto
  ): Promise<ServicePoint> {
    // Varsayılan değerler
    const servicePoint = this.servicePointRepository.create({
      ...dto,
      eventId,
      pointType: dto.pointType || "bar",
      requiredStaffCount: dto.requiredStaffCount || 1,
      allowedRoles: dto.allowedRoles || ["barman", "garson"],
      color: dto.color || "#06b6d4",
      shape: dto.shape || "square",
    });

    return this.servicePointRepository.save(servicePoint);
  }

  /**
   * Hizmet noktasını güncelle
   */
  async update(id: string, dto: UpdateServicePointDto): Promise<ServicePoint> {
    const servicePoint = await this.findOne(id);
    Object.assign(servicePoint, dto);
    return this.servicePointRepository.save(servicePoint);
  }

  /**
   * Hizmet noktasını sil
   */
  async delete(id: string): Promise<{ message: string }> {
    const servicePoint = await this.findOne(id);
    await this.servicePointRepository.remove(servicePoint);
    return { message: "Hizmet noktası silindi" };
  }

  // ==================== STAFF ASSIGNMENTS ====================

  /**
   * Hizmet noktasına ait personel atamalarını getir
   */
  async findAssignmentsByServicePoint(
    servicePointId: string
  ): Promise<ServicePointStaffAssignment[]> {
    return this.assignmentRepository.find({
      where: { servicePointId, isActive: true },
      relations: ["staff", "shift"],
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * Etkinliğe ait tüm hizmet noktası personel atamalarını getir
   */
  async findAllAssignmentsByEvent(
    eventId: string
  ): Promise<ServicePointStaffAssignment[]> {
    return this.assignmentRepository.find({
      where: { eventId, isActive: true },
      relations: ["staff", "shift", "servicePoint"],
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /**
   * Personel ataması oluştur
   */
  async createAssignment(
    eventId: string,
    dto: CreateServicePointStaffAssignmentDto
  ): Promise<ServicePointStaffAssignment> {
    // Hizmet noktasının varlığını kontrol et
    const servicePoint = await this.findOne(dto.servicePointId);
    if (servicePoint.eventId !== eventId) {
      throw new BadRequestException("Hizmet noktası bu etkinliğe ait değil");
    }

    // Aynı personel aynı hizmet noktasına zaten atanmış mı kontrol et
    const existing = await this.assignmentRepository.findOne({
      where: {
        servicePointId: dto.servicePointId,
        staffId: dto.staffId,
        isActive: true,
      },
    });
    if (existing) {
      throw new BadRequestException(
        "Bu personel zaten bu hizmet noktasına atanmış"
      );
    }

    const assignment = this.assignmentRepository.create({
      ...dto,
      eventId,
    });

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Toplu personel ataması oluştur
   */
  async createBulkAssignments(
    eventId: string,
    assignments: CreateServicePointStaffAssignmentDto[]
  ): Promise<ServicePointStaffAssignment[]> {
    const results: ServicePointStaffAssignment[] = [];

    for (const dto of assignments) {
      try {
        const assignment = await this.createAssignment(eventId, dto);
        results.push(assignment);
      } catch (error) {
        // Hata durumunda devam et, başarılı olanları döndür
        console.warn(`Atama oluşturulamadı: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Personel atamasını güncelle
   */
  async updateAssignment(
    id: string,
    dto: UpdateServicePointStaffAssignmentDto
  ): Promise<ServicePointStaffAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });
    if (!assignment) {
      throw new NotFoundException("Personel ataması bulunamadı");
    }

    Object.assign(assignment, dto);
    return this.assignmentRepository.save(assignment);
  }

  /**
   * Personel atamasını sil
   */
  async deleteAssignment(id: string): Promise<{ message: string }> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
    });
    if (!assignment) {
      throw new NotFoundException("Personel ataması bulunamadı");
    }

    await this.assignmentRepository.remove(assignment);
    return { message: "Personel ataması silindi" };
  }

  /**
   * Hizmet noktasındaki tüm atamaları sil
   */
  async deleteAllAssignmentsByServicePoint(
    servicePointId: string
  ): Promise<{ message: string; count: number }> {
    const result = await this.assignmentRepository.delete({ servicePointId });
    return {
      message: "Tüm atamalar silindi",
      count: result.affected || 0,
    };
  }

  // ==================== STATISTICS ====================

  /**
   * Etkinlik için hizmet noktası istatistikleri
   */
  async getEventServicePointStats(eventId: string): Promise<{
    totalServicePoints: number;
    totalRequiredStaff: number;
    totalAssignedStaff: number;
    completionRate: number;
    byPointType: Record<string, number>;
  }> {
    const servicePoints = await this.findAllByEvent(eventId);
    const assignments = await this.findAllAssignmentsByEvent(eventId);

    const totalServicePoints = servicePoints.length;
    const totalRequiredStaff = servicePoints.reduce(
      (sum, sp) => sum + sp.requiredStaffCount,
      0
    );
    const totalAssignedStaff = assignments.length;
    const completionRate =
      totalRequiredStaff > 0
        ? Math.round((totalAssignedStaff / totalRequiredStaff) * 100)
        : 0;

    // Nokta tipine göre dağılım
    const byPointType: Record<string, number> = {};
    servicePoints.forEach((sp) => {
      byPointType[sp.pointType] = (byPointType[sp.pointType] || 0) + 1;
    });

    return {
      totalServicePoints,
      totalRequiredStaff,
      totalAssignedStaff,
      completionRate,
      byPointType,
    };
  }
}
