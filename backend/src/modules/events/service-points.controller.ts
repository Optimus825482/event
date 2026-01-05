import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ServicePointsService } from "./service-points.service";
import {
  CreateServicePointDto,
  UpdateServicePointDto,
  CreateServicePointStaffAssignmentDto,
  UpdateServicePointStaffAssignmentDto,
  BulkServicePointStaffAssignmentDto,
} from "./dto/service-point.dto";

@Controller("events/:eventId/service-points")
@UseGuards(JwtAuthGuard)
@SkipThrottle() // Rate limiting devre dışı - team-organization paralel istekler yapıyor
export class ServicePointsController {
  constructor(private readonly servicePointsService: ServicePointsService) {}

  // ==================== SERVICE POINTS ====================

  /**
   * Etkinliğe ait tüm hizmet noktalarını getir
   */
  @Get()
  async findAll(@Param("eventId") eventId: string) {
    return this.servicePointsService.findAllByEvent(eventId);
  }

  /**
   * Tek bir hizmet noktasını getir
   */
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.servicePointsService.findOne(id);
  }

  /**
   * Yeni hizmet noktası oluştur
   */
  @Post()
  async create(
    @Param("eventId") eventId: string,
    @Body() dto: CreateServicePointDto
  ) {
    return this.servicePointsService.create(eventId, dto);
  }

  /**
   * Hizmet noktasını güncelle
   */
  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateServicePointDto) {
    return this.servicePointsService.update(id, dto);
  }

  /**
   * Hizmet noktasını sil
   */
  @Delete(":id")
  async delete(@Param("id") id: string) {
    return this.servicePointsService.delete(id);
  }

  // ==================== STAFF ASSIGNMENTS ====================

  /**
   * Hizmet noktasına ait personel atamalarını getir
   */
  @Get(":servicePointId/assignments")
  async findAssignments(@Param("servicePointId") servicePointId: string) {
    return this.servicePointsService.findAssignmentsByServicePoint(
      servicePointId
    );
  }

  /**
   * Etkinliğe ait tüm hizmet noktası personel atamalarını getir
   */
  @Get("assignments/all")
  async findAllAssignments(@Param("eventId") eventId: string) {
    return this.servicePointsService.findAllAssignmentsByEvent(eventId);
  }

  /**
   * Personel ataması oluştur
   */
  @Post("assignments")
  async createAssignment(
    @Param("eventId") eventId: string,
    @Body() dto: CreateServicePointStaffAssignmentDto
  ) {
    return this.servicePointsService.createAssignment(eventId, dto);
  }

  /**
   * Toplu personel ataması oluştur
   */
  @Post("assignments/bulk")
  async createBulkAssignments(
    @Param("eventId") eventId: string,
    @Body() dto: BulkServicePointStaffAssignmentDto
  ) {
    return this.servicePointsService.createBulkAssignments(
      eventId,
      dto.assignments
    );
  }

  /**
   * Personel atamasını güncelle
   */
  @Put("assignments/:assignmentId")
  async updateAssignment(
    @Param("assignmentId") assignmentId: string,
    @Body() dto: UpdateServicePointStaffAssignmentDto
  ) {
    return this.servicePointsService.updateAssignment(assignmentId, dto);
  }

  /**
   * Personel atamasını sil
   */
  @Delete("assignments/:assignmentId")
  async deleteAssignment(@Param("assignmentId") assignmentId: string) {
    return this.servicePointsService.deleteAssignment(assignmentId);
  }

  // ==================== STATISTICS ====================

  /**
   * Etkinlik için hizmet noktası istatistikleri
   */
  @Get("stats/summary")
  async getStats(@Param("eventId") eventId: string) {
    return this.servicePointsService.getEventServicePointStats(eventId);
  }
}
