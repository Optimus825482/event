import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { StaffService } from "./staff.service";
import { StaffPosition } from "../../entities/user.entity";

// DTO tanımları
interface CreateStaffDto {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
  color?: string;
  position?: StaffPosition;
  avatar?: string;
}

interface UpdateStaffDto {
  fullName?: string;
  phone?: string;
  color?: string;
  position?: StaffPosition;
  avatar?: string;
  isActive?: boolean;
}

interface AssignTablesDto {
  eventId: string;
  staffId: string;
  tableIds: string[];
  color?: string;
}

interface BulkAssignDto {
  eventId: string;
  assignments: Array<{
    staffId: string;
    tableIds: string[];
  }>;
}

@Controller("staff")
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // Tüm personeli listele
  @Get()
  findAll(@Query("active") active?: string) {
    const onlyActive = active === "true";
    return this.staffService.findAllStaff(onlyActive);
  }

  // Yeni personel oluştur
  @Post()
  async createStaff(@Body() dto: CreateStaffDto) {
    try {
      return await this.staffService.createStaff(dto);
    } catch (error) {
      throw new BadRequestException(error.message || "Personel oluşturulamadı");
    }
  }

  // Personel güncelle
  @Put(":id")
  async updateStaff(@Param("id") id: string, @Body() dto: UpdateStaffDto) {
    try {
      return await this.staffService.updateStaff(id, dto);
    } catch (error) {
      throw new BadRequestException(error.message || "Personel güncellenemedi");
    }
  }

  // Personel sil (soft delete - isActive = false)
  @Delete(":id")
  async deleteStaff(@Param("id") id: string) {
    return this.staffService.deactivateStaff(id);
  }

  // Tek bir personelin detayları
  @Get(":id")
  getStaffById(@Param("id") id: string) {
    return this.staffService.getStaffById(id);
  }

  // Masa ataması yap
  @Post("assign")
  assignTables(@Body() dto: AssignTablesDto) {
    return this.staffService.assignTables(
      dto.eventId,
      dto.staffId,
      dto.tableIds,
      dto.color
    );
  }

  // Toplu atama yap
  @Post("assign/bulk")
  bulkAssignTables(@Body() dto: BulkAssignDto) {
    return this.staffService.bulkAssignTables(dto.eventId, dto.assignments);
  }

  // Atama kaldır
  @Delete("assign/:eventId/:staffId")
  removeAssignment(
    @Param("eventId") eventId: string,
    @Param("staffId") staffId: string
  ) {
    return this.staffService.removeAssignment(eventId, staffId);
  }

  // Etkinlik için tüm atamaları getir
  @Get("event/:eventId")
  getEventAssignments(@Param("eventId") eventId: string) {
    return this.staffService.getEventAssignments(eventId);
  }

  // Etkinlik için atama özeti (istatistikler)
  @Get("event/:eventId/summary")
  getEventAssignmentSummary(@Param("eventId") eventId: string) {
    return this.staffService.getEventAssignmentSummary(eventId);
  }

  // Personelin baktığı masaları getir
  @Get("event/:eventId/staff/:staffId")
  getStaffTables(
    @Param("eventId") eventId: string,
    @Param("staffId") staffId: string
  ) {
    return this.staffService.getStaffTables(eventId, staffId);
  }

  // Otomatik atama önerisi
  @Post("event/:eventId/auto-assign")
  autoAssignTables(
    @Param("eventId") eventId: string,
    @Body()
    dto: { staffIds: string[]; strategy?: "balanced" | "zone" | "random" }
  ) {
    return this.staffService.autoAssignTables(
      eventId,
      dto.staffIds,
      dto.strategy || "balanced"
    );
  }

  // Atamaları kaydet (tüm etkinlik için)
  @Post("event/:eventId/save")
  saveEventAssignments(
    @Param("eventId") eventId: string,
    @Body()
    dto: {
      assignments: Array<{
        staffId: string;
        tableIds: string[];
        color?: string;
      }>;
    }
  ) {
    return this.staffService.saveEventAssignments(eventId, dto.assignments);
  }

  // ==================== TEAM ENDPOINT'LERİ ====================

  // Etkinlik için tüm ekipleri getir
  @Get("event/:eventId/teams")
  getEventTeams(@Param("eventId") eventId: string) {
    return this.staffService.getEventTeams(eventId);
  }

  // Yeni ekip oluştur
  @Post("teams")
  createTeam(
    @Body()
    dto: {
      eventId: string;
      name: string;
      color: string;
      members?: any[];
      leaderId?: string;
      tableIds?: string[];
    }
  ) {
    return this.staffService.createTeam(dto);
  }

  // Ekip güncelle
  @Put("teams/:teamId")
  updateTeam(
    @Param("teamId") teamId: string,
    @Body()
    dto: {
      name?: string;
      color?: string;
      members?: any[];
      leaderId?: string;
      tableIds?: string[];
    }
  ) {
    return this.staffService.updateTeam(teamId, dto);
  }

  // Ekip sil
  @Delete("teams/:teamId")
  deleteTeam(@Param("teamId") teamId: string) {
    return this.staffService.deleteTeam(teamId);
  }

  // Ekibe üye ekle
  @Post("teams/:teamId/members")
  addMemberToTeam(@Param("teamId") teamId: string, @Body() member: any) {
    return this.staffService.addMemberToTeam(teamId, member);
  }

  // Ekipten üye çıkar
  @Delete("teams/:teamId/members/:memberId")
  removeMemberFromTeam(
    @Param("teamId") teamId: string,
    @Param("memberId") memberId: string
  ) {
    return this.staffService.removeMemberFromTeam(teamId, memberId);
  }

  // Ekibe masa ata
  @Post("teams/:teamId/tables")
  assignTablesToTeam(
    @Param("teamId") teamId: string,
    @Body() dto: { tableIds: string[] }
  ) {
    return this.staffService.assignTablesToTeam(teamId, dto.tableIds);
  }

  // Ekipten masa kaldır
  @Delete("teams/:teamId/tables")
  removeTablesFromTeam(
    @Param("teamId") teamId: string,
    @Body() dto: { tableIds: string[] }
  ) {
    return this.staffService.removeTablesFromTeam(teamId, dto.tableIds);
  }

  // Tüm ekipleri toplu kaydet
  @Post("event/:eventId/teams/save")
  saveEventTeams(
    @Param("eventId") eventId: string,
    @Body()
    dto: {
      teams: Array<{
        id?: string;
        name: string;
        color: string;
        members: any[];
        leaderId?: string;
        tableIds: string[];
      }>;
    }
  ) {
    return this.staffService.saveEventTeams(eventId, dto.teams);
  }
}
