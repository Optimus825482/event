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

  // ==================== STAFF ROLE ENDPOINT'LERİ (ÖNCELİKLİ) ====================
  // NOT: Bu endpoint'ler :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm rolleri getir
  @Get("roles")
  getAllRoles() {
    return this.staffService.getAllRoles();
  }

  // Süpervizörleri getir
  @Get("supervisors")
  getSupervisors() {
    return this.staffService.getSupervisors();
  }

  // ==================== WORK SHIFT (ÇALIŞMA SAATLERİ) GET ====================
  // NOT: Bu endpoint :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm çalışma saatlerini getir
  @Get("shifts")
  getAllShifts() {
    return this.staffService.getAllShifts();
  }

  // ==================== TEAM (EKİP) GET ====================
  // NOT: Bu endpoint :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm ekipleri getir
  @Get("teams")
  getAllTeams() {
    return this.staffService.getAllTeams();
  }

  // ==================== ORGANIZATION TEMPLATE GET ====================
  // NOT: Bu endpoint :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm şablonları getir
  @Get("organization-templates")
  getOrganizationTemplates() {
    return this.staffService.getOrganizationTemplates();
  }

  // Tek şablon getir
  @Get("organization-templates/:id")
  getOrganizationTemplateById(@Param("id") id: string) {
    return this.staffService.getOrganizationTemplateById(id);
  }

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

  // Personelin tüm etkinliklerdeki atamalarını getir
  @Get(":id/event-assignments")
  getStaffEventAssignments(@Param("id") staffId: string) {
    return this.staffService.getStaffEventAssignments(staffId);
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

  // ==================== SERVICE TEAM ENDPOINT'LERİ (ETKİNLİK BAZLI) ====================

  // Etkinlik için tüm servis ekiplerini getir
  @Get("event/:eventId/teams")
  getEventTeams(@Param("eventId") eventId: string) {
    return this.staffService.getEventTeams(eventId);
  }

  // Yeni servis ekibi oluştur (etkinlik bazlı)
  @Post("service-teams")
  createServiceTeam(
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
    return this.staffService.createServiceTeam(dto);
  }

  // Servis ekibi güncelle
  @Put("service-teams/:teamId")
  updateServiceTeam(
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
    return this.staffService.updateServiceTeam(teamId, dto);
  }

  // Servis ekibi sil
  @Delete("service-teams/:teamId")
  deleteServiceTeam(@Param("teamId") teamId: string) {
    return this.staffService.deleteServiceTeam(teamId);
  }

  // Servis ekibine üye ekle
  @Post("service-teams/:teamId/members")
  addMemberToServiceTeam(@Param("teamId") teamId: string, @Body() member: any) {
    return this.staffService.addMemberToServiceTeam(teamId, member);
  }

  // Servis ekibinden üye çıkar
  @Delete("service-teams/:teamId/members/:memberId")
  removeMemberFromServiceTeam(
    @Param("teamId") teamId: string,
    @Param("memberId") memberId: string
  ) {
    return this.staffService.removeMemberFromServiceTeam(teamId, memberId);
  }

  // Servis ekibine masa ata
  @Post("service-teams/:teamId/tables")
  assignTablesToServiceTeam(
    @Param("teamId") teamId: string,
    @Body() dto: { tableIds: string[] }
  ) {
    return this.staffService.assignTablesToServiceTeam(teamId, dto.tableIds);
  }

  // Servis ekibinden masa kaldır
  @Delete("service-teams/:teamId/tables")
  removeTablesFromServiceTeam(
    @Param("teamId") teamId: string,
    @Body() dto: { tableIds: string[] }
  ) {
    return this.staffService.removeTablesFromServiceTeam(teamId, dto.tableIds);
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

  // ==================== TABLE GROUP ENDPOINT'LERİ ====================

  // Etkinlik için tüm masa gruplarını getir
  @Get("event/:eventId/table-groups")
  getEventTableGroups(@Param("eventId") eventId: string) {
    return this.staffService.getEventTableGroups(eventId);
  }

  // Yeni masa grubu oluştur
  @Post("table-groups")
  createTableGroup(
    @Body()
    dto: {
      eventId: string;
      name: string;
      color?: string;
      tableIds: string[];
      groupType?: string;
      notes?: string;
    }
  ) {
    return this.staffService.createTableGroup(dto);
  }

  // Masa grubu güncelle
  @Put("table-groups/:groupId")
  updateTableGroup(
    @Param("groupId") groupId: string,
    @Body()
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
  ) {
    return this.staffService.updateTableGroup(groupId, dto);
  }

  // Masa grubu sil
  @Delete("table-groups/:groupId")
  deleteTableGroup(@Param("groupId") groupId: string) {
    return this.staffService.deleteTableGroup(groupId);
  }

  // Gruba masa ekle
  @Post("table-groups/:groupId/tables")
  addTablesToGroup(
    @Param("groupId") groupId: string,
    @Body() dto: { tableIds: string[] }
  ) {
    return this.staffService.addTablesToGroup(groupId, dto.tableIds);
  }

  // Gruptan masa çıkar
  @Delete("table-groups/:groupId/tables")
  removeTablesFromGroup(
    @Param("groupId") groupId: string,
    @Body() dto: { tableIds: string[] }
  ) {
    return this.staffService.removeTablesFromGroup(groupId, dto.tableIds);
  }

  // Gruba süpervizör ata
  @Post("table-groups/:groupId/supervisor")
  assignSupervisorToGroup(
    @Param("groupId") groupId: string,
    @Body() dto: { supervisorId: string }
  ) {
    return this.staffService.assignSupervisorToGroup(groupId, dto.supervisorId);
  }

  // Gruptan süpervizör kaldır
  @Delete("table-groups/:groupId/supervisor")
  removeSupervisorFromGroup(@Param("groupId") groupId: string) {
    return this.staffService.removeSupervisorFromGroup(groupId);
  }

  // Gruba ekip ata
  @Post("table-groups/:groupId/team")
  assignTeamToGroup(
    @Param("groupId") groupId: string,
    @Body() dto: { teamId: string }
  ) {
    return this.staffService.assignTeamToGroup(groupId, dto.teamId);
  }

  // Tüm masa gruplarını toplu kaydet
  @Post("event/:eventId/table-groups/save")
  saveEventTableGroups(
    @Param("eventId") eventId: string,
    @Body()
    dto: {
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
      }>;
    }
  ) {
    return this.staffService.saveEventTableGroups(eventId, dto.groups);
  }

  // Etkinlik organizasyon özeti
  @Get("event/:eventId/organization-summary")
  getEventOrganizationSummary(@Param("eventId") eventId: string) {
    return this.staffService.getEventOrganizationSummary(eventId);
  }

  // ==================== STAFF ROLE CRUD (POST/PUT/DELETE) ====================

  // Yeni rol oluştur
  @Post("roles")
  createRole(
    @Body()
    dto: {
      key: string;
      label: string;
      color: string;
      badgeColor?: string;
      bgColor?: string;
    }
  ) {
    return this.staffService.createRole(dto);
  }

  // Rol güncelle
  @Put("roles/:id")
  updateRole(
    @Param("id") id: string,
    @Body()
    dto: {
      label?: string;
      color?: string;
      badgeColor?: string;
      bgColor?: string;
      sortOrder?: number;
    }
  ) {
    return this.staffService.updateRole(id, dto);
  }

  // Rol sil (soft delete)
  @Delete("roles/:id")
  deleteRole(@Param("id") id: string) {
    return this.staffService.deleteRole(id);
  }

  // Rol kalıcı sil
  @Delete("roles/:id/hard")
  hardDeleteRole(@Param("id") id: string) {
    return this.staffService.hardDeleteRole(id);
  }

  // ==================== WORK SHIFT (ÇALIŞMA SAATLERİ) CRUD ====================

  // Yeni çalışma saati oluştur
  @Post("shifts")
  createShift(
    @Body()
    dto: {
      name: string;
      startTime: string;
      endTime: string;
      color?: string;
    }
  ) {
    return this.staffService.createShift(dto);
  }

  // Çalışma saati güncelle
  @Put("shifts/:id")
  updateShift(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      startTime?: string;
      endTime?: string;
      color?: string;
      sortOrder?: number;
    }
  ) {
    return this.staffService.updateShift(id, dto);
  }

  // Çalışma saati sil
  @Delete("shifts/:id")
  deleteShift(@Param("id") id: string) {
    return this.staffService.deleteShift(id);
  }

  // ==================== TEAM (EKİP) CRUD ====================

  // Yeni ekip oluştur
  @Post("teams")
  createTeam(
    @Body()
    dto: {
      name: string;
      color?: string;
      memberIds?: string[];
      leaderId?: string;
    }
  ) {
    return this.staffService.createTeam(dto);
  }

  // Ekip güncelle
  @Put("teams/:id")
  updateTeam(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      color?: string;
      memberIds?: string[];
      leaderId?: string;
      sortOrder?: number;
    }
  ) {
    return this.staffService.updateTeam(id, dto);
  }

  // Ekip sil
  @Delete("teams/:id")
  deleteTeamById(@Param("id") id: string) {
    return this.staffService.deleteTeam(id);
  }

  // Ekibe üye ekle
  @Post("teams/:id/members")
  addMemberToTeam(
    @Param("id") teamId: string,
    @Body() dto: { memberId: string }
  ) {
    return this.staffService.addMemberToTeam(teamId, dto.memberId);
  }

  // Ekipten üye çıkar
  @Delete("teams/:id/members/:memberId")
  removeMemberFromTeam(
    @Param("id") teamId: string,
    @Param("memberId") memberId: string
  ) {
    return this.staffService.removeMemberFromTeam(teamId, memberId);
  }

  // ==================== EVENT STAFF ASSIGNMENT ENDPOINT'LERİ ====================

  // Etkinlik için tüm personel atamalarını getir
  @Get("event/:eventId/staff-assignments")
  getEventStaffAssignments(@Param("eventId") eventId: string) {
    return this.staffService.getEventStaffAssignments(eventId);
  }

  // Personel ata (masa/masalara veya özel görev)
  @Post("event/:eventId/staff-assignments")
  assignStaffToTables(
    @Param("eventId") eventId: string,
    @Body()
    dto: {
      staffId: string;
      tableIds: string[];
      shiftId?: string;
      teamId?: string;
      color?: string;
      assignmentType?: string;
      specialTaskLocation?: string;
      specialTaskStartTime?: string;
      specialTaskEndTime?: string;
    }
  ) {
    return this.staffService.assignStaffToTables({ eventId, ...dto });
  }

  // Personel atamasını güncelle
  @Put("staff-assignments/:assignmentId")
  updateStaffAssignment(
    @Param("assignmentId") assignmentId: string,
    @Body()
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
  ) {
    return this.staffService.updateStaffAssignment(assignmentId, dto);
  }

  // Personel atamasını kaldır
  @Delete("staff-assignments/:assignmentId")
  removeStaffAssignment(@Param("assignmentId") assignmentId: string) {
    return this.staffService.removeStaffAssignment(assignmentId);
  }

  // Tüm etkinlik atamalarını kaydet (toplu)
  @Post("event/:eventId/staff-assignments/save")
  saveEventStaffAssignments(
    @Param("eventId") eventId: string,
    @Body()
    dto: {
      assignments: Array<{
        staffId: string;
        tableIds: string[];
        shiftId?: string;
        teamId?: string;
        color?: string;
      }>;
    }
  ) {
    return this.staffService.saveEventStaffAssignments(
      eventId,
      dto.assignments
    );
  }

  // ==================== ORGANIZATION TEMPLATE ENDPOINT'LERİ (POST/DELETE) ====================

  // Şablon oluştur (mevcut etkinlik organizasyonundan)
  @Post("organization-templates")
  createOrganizationTemplate(
    @Body()
    dto: {
      name: string;
      description?: string;
      createdById?: string;
      eventId: string;
    }
  ) {
    return this.staffService.createOrganizationTemplate(dto);
  }

  // Şablonu etkinliğe uygula
  @Post("organization-templates/:id/apply")
  applyOrganizationTemplate(
    @Param("id") templateId: string,
    @Body() dto: { eventId: string }
  ) {
    return this.staffService.applyOrganizationTemplate(templateId, dto.eventId);
  }

  // Şablon sil
  @Delete("organization-templates/:id")
  deleteOrganizationTemplate(@Param("id") id: string) {
    return this.staffService.deleteOrganizationTemplate(id);
  }

  // Varsayılan şablon yap
  @Post("organization-templates/:id/set-default")
  setDefaultTemplate(@Param("id") id: string) {
    return this.staffService.setDefaultTemplate(id);
  }
}
