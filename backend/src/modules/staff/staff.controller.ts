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
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { StaffService } from "./staff.service";
import { StaffPosition } from "../../entities/user.entity";
import { Staff, Gender, StaffStatus } from "../../entities/staff.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

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

  // ==================== POSITIONS (UNVANLAR) ====================
  // NOT: Bu endpoint'ler :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm unvanları getir
  @Get("positions")
  getAllPositions(@Query("all") all?: string) {
    const onlyActive = all !== "true";
    return this.staffService.getAllPositions(onlyActive);
  }

  // Yeni unvan ekle
  @Post("positions")
  createPosition(@Body() dto: { name: string; description?: string }) {
    return this.staffService.createPosition(dto);
  }

  // Unvan güncelle
  @Put("positions/:id")
  updatePosition(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    return this.staffService.updatePosition(id, dto);
  }

  // Unvan sil
  @Delete("positions/:id")
  deletePosition(@Param("id") id: string) {
    return this.staffService.deletePosition(id);
  }

  // ==================== DEPARTMENTS (BÖLÜMLER) ====================
  // NOT: Bu endpoint'ler :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm bölümleri getir
  @Get("departments")
  getAllDepartments(@Query("all") all?: string) {
    const onlyActive = all !== "true";
    return this.staffService.getAllDepartments(onlyActive);
  }

  // Yeni bölüm ekle
  @Post("departments")
  createDepartment(
    @Body() dto: { name: string; description?: string; color?: string }
  ) {
    return this.staffService.createDepartment(dto);
  }

  // Bölüm güncelle
  @Put("departments/:id")
  updateDepartment(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      color?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    return this.staffService.updateDepartment(id, dto);
  }

  // Bölüm sil
  @Delete("departments/:id")
  deleteDepartment(@Param("id") id: string) {
    return this.staffService.deleteDepartment(id);
  }

  // ==================== WORK LOCATIONS (GÖREV YERLERİ) ====================
  // NOT: Bu endpoint'ler :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm görev yerlerini getir
  @Get("work-locations")
  getAllWorkLocations(@Query("all") all?: string) {
    const onlyActive = all !== "true";
    return this.staffService.getAllWorkLocations(onlyActive);
  }

  // Yeni görev yeri ekle
  @Post("work-locations")
  createWorkLocation(
    @Body() dto: { name: string; description?: string; address?: string }
  ) {
    return this.staffService.createWorkLocation(dto);
  }

  // Görev yeri güncelle
  @Put("work-locations/:id")
  updateWorkLocation(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      address?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ) {
    return this.staffService.updateWorkLocation(id, dto);
  }

  // Görev yeri sil
  @Delete("work-locations/:id")
  deleteWorkLocation(@Param("id") id: string) {
    return this.staffService.deleteWorkLocation(id);
  }

  // ==================== İLİŞKİ ENDPOINT'LERİ ====================

  // Departmana ait pozisyonları getir
  @Get("departments/:id/positions")
  getPositionsByDepartment(@Param("id") id: string) {
    return this.staffService.getPositionsByDepartment(id);
  }

  // Departmana ait görev yerlerini getir
  @Get("departments/:id/locations")
  getLocationsByDepartment(@Param("id") id: string) {
    return this.staffService.getLocationsByDepartment(id);
  }

  // Departman detaylarını ilişkileriyle getir
  @Get("departments/:id/details")
  getDepartmentWithRelations(@Param("id") id: string) {
    return this.staffService.getDepartmentWithRelations(id);
  }

  // Tüm departmanları ilişkileriyle getir
  @Get("departments-with-relations")
  getAllDepartmentsWithRelations() {
    return this.staffService.getAllDepartmentsWithRelations();
  }

  // Departmanın pozisyonlarını güncelle
  @Put("departments/:id/positions")
  updateDepartmentPositions(
    @Param("id") id: string,
    @Body() dto: { positionIds: string[] }
  ) {
    return this.staffService.updateDepartmentPositions(id, dto.positionIds);
  }

  // Departmanın görev yerlerini güncelle
  @Put("departments/:id/locations")
  updateDepartmentLocations(
    @Param("id") id: string,
    @Body() dto: { locationIds: string[] }
  ) {
    return this.staffService.updateDepartmentLocations(id, dto.locationIds);
  }

  // İlişkileri staff verilerinden senkronize et
  @Post("sync-relations")
  syncRelationsFromStaffData() {
    return this.staffService.syncRelationsFromStaffData();
  }

  // Süpervizörleri getir
  @Get("supervisors")
  getSupervisors() {
    return this.staffService.getSupervisors();
  }

  // ==================== WORK SHIFT (ÇALIŞMA SAATLERİ) GET ====================
  // NOT: Bu endpoint :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm çalışma saatlerini getir (global + opsiyonel eventId)
  @Get("shifts")
  getAllShifts(@Query("eventId") eventId?: string) {
    return this.staffService.getAllShifts(eventId);
  }

  // Etkinliğe özel vardiyaları getir
  @Get("events/:eventId/shifts")
  getEventShifts(@Param("eventId") eventId: string) {
    return this.staffService.getEventShifts(eventId);
  }

  // Etkinliğe özel toplu vardiya oluştur
  @Post("events/:eventId/shifts/bulk")
  createBulkShifts(
    @Param("eventId") eventId: string,
    @Body()
    dto: {
      shifts: Array<{
        name: string;
        startTime: string;
        endTime: string;
        color?: string;
      }>;
    }
  ) {
    return this.staffService.createBulkShifts(eventId, dto.shifts);
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

  // ==================== PERSONNEL (YENİ STAFF ENTITY) GET ENDPOINT'LERİ ====================
  // NOT: Bu endpoint'ler :id parametreli endpoint'lerden ÖNCE olmalı!

  // Tüm personeli listele (yeni Staff tablosundan)
  @Get("personnel")
  findAllPersonnel(
    @Query("department") department?: string,
    @Query("workLocation") workLocation?: string,
    @Query("position") position?: string,
    @Query("isActive") isActive?: string,
    @Query("status") status?: string
  ) {
    return this.staffService.findAllPersonnel({
      department,
      workLocation,
      position,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
      status,
    });
  }

  // Personel istatistikleri
  @Get("personnel/stats")
  getPersonnelStats() {
    return this.staffService.getPersonnelStats();
  }

  // ==================== LAZY LOADING ENDPOINT'LERİ ====================

  // Pozisyon bazlı özet (sadece pozisyon adı ve sayısı)
  @Get("personnel/summary/by-position")
  getPersonnelSummaryByPosition() {
    return this.staffService.getPersonnelSummaryByPosition();
  }

  // Departman bazlı özet
  @Get("personnel/summary/by-department")
  getPersonnelSummaryByDepartment() {
    return this.staffService.getPersonnelSummaryByDepartment();
  }

  // Pozisyona göre personel listesi (lazy loading)
  @Get("personnel/by-position/:position")
  getPersonnelByPosition(@Param("position") position: string) {
    return this.staffService.getPersonnelByPosition(
      decodeURIComponent(position)
    );
  }

  // Departmana göre personel listesi (lazy loading)
  @Get("personnel/by-department/:department")
  getPersonnelByDepartment(@Param("department") department: string) {
    return this.staffService.getPersonnelByDepartment(
      decodeURIComponent(department)
    );
  }

  // Sicil numarası ile personel getir
  @Get("personnel/sicil/:sicilNo")
  getPersonnelBySicilNo(@Param("sicilNo") sicilNo: string) {
    return this.staffService.getPersonnelBySicilNo(sicilNo);
  }

  // Tek personel getir (ID ile) - Bu :id'den önce olmalı
  @Get("personnel/:id")
  getPersonnelById(@Param("id") id: string) {
    return this.staffService.getPersonnelById(id);
  }

  // Tüm personeli listele
  @Get()
  findAll(@Query("active") active?: string) {
    const onlyActive = active === "true";
    return this.staffService.findAllStaff(onlyActive);
  }

  // ==================== EVENT STAFF ASSIGNMENT ENDPOINT'LERİ ====================
  // NOT: Bu route'lar :id parametreli route'lardan ÖNCE olmalı!

  // Etkinlik için tüm personel atamalarını getir
  @Get("events/:eventId/assignments")
  getEventStaffAssignments(@Param("eventId") eventId: string) {
    return this.staffService.getEventStaffAssignments(eventId);
  }

  // Personel ata (masa/masalara veya özel görev)
  @Post("events/:eventId/assignments")
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

  // Tüm etkinlik atamalarını kaydet (toplu)
  @Post("events/:eventId/assignments/save")
  @UseGuards(JwtAuthGuard)
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
    },
    @Request() req
  ) {
    const userId = req.user?.id;
    return this.staffService.saveEventStaffAssignments(
      eventId,
      dto.assignments,
      userId
    );
  }

  // Personel atamasını güncelle
  @Put("assignments/:assignmentId")
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
  @Delete("assignments/:assignmentId")
  removeStaffAssignment(@Param("assignmentId") assignmentId: string) {
    return this.staffService.removeStaffAssignment(assignmentId);
  }

  // ==================== END EVENT STAFF ASSIGNMENT ====================

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
    console.log("🔵 [Controller] saveEventTableGroups called");
    console.log("🔵 [Controller] eventId:", eventId);
    console.log("🔵 [Controller] groups count:", dto?.groups?.length);
    console.log(
      "🔵 [Controller] first group:",
      JSON.stringify(dto?.groups?.[0], null, 2)
    );
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

  // Yeni çalışma saati oluştur (global veya etkinliğe özel)
  @Post("shifts")
  createShift(
    @Body()
    dto: {
      name: string;
      startTime: string;
      endTime: string;
      color?: string;
      eventId?: string;
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

  // Toplu ekip sil
  @Delete("teams/bulk/delete")
  bulkDeleteTeams(@Body() dto: { teamIds: string[] }) {
    return this.staffService.bulkDeleteTeams(dto.teamIds);
  }

  // Ekip liderini ata/değiştir - HIZLI ENDPOINT
  @Put("teams/:id/leader")
  setTeamLeader(
    @Param("id") teamId: string,
    @Body() dto: { leaderId: string | null }
  ) {
    return this.staffService.setTeamLeader(teamId, dto.leaderId);
  }

  // Ekibe üye ekle
  @Post("teams/:id/members")
  addMemberToTeam(
    @Param("id") teamId: string,
    @Body() dto: { memberId: string }
  ) {
    return this.staffService.addMemberToTeam(teamId, dto.memberId);
  }

  // Ekibe toplu üye ekle
  @Post("teams/:id/members/bulk")
  addMembersToTeamBulk(
    @Param("id") teamId: string,
    @Body() dto: { memberIds: string[] }
  ) {
    return this.staffService.addMembersToTeamBulk(teamId, dto.memberIds);
  }

  // Ekipten üye çıkar
  @Delete("teams/:id/members/:memberId")
  removeMemberFromTeam(
    @Param("id") teamId: string,
    @Param("memberId") memberId: string
  ) {
    return this.staffService.removeMemberFromTeam(teamId, memberId);
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

  // ==================== PERSONNEL (YENİ STAFF ENTITY) POST/PUT/DELETE ENDPOINT'LERİ ====================

  // Yeni personel oluştur
  @Post("personnel")
  createPersonnel(
    @Body()
    dto: {
      sicilNo: string;
      fullName: string;
      email?: string;
      phone?: string;
      avatar?: string;
      position: string;
      department?: string;
      workLocation?: string;
      mentor?: string;
      color?: string;
      gender?: Gender;
      birthDate?: string;
      age?: number;
      bloodType?: string;
      shoeSize?: number;
      sockSize?: string;
      hireDate?: string;
      terminationDate?: string;
      terminationReason?: string;
      yearsAtCompany?: number;
      isActive?: boolean;
      status?: StaffStatus;
    }
  ) {
    // Tarih string'lerini Date'e çevir
    const staffData: Partial<Staff> = {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      terminationDate: dto.terminationDate
        ? new Date(dto.terminationDate)
        : undefined,
    };
    return this.staffService.createPersonnel(staffData);
  }

  // Personel güncelle
  @Put("personnel/:id")
  updatePersonnel(
    @Param("id") id: string,
    @Body()
    dto: {
      sicilNo?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      avatar?: string;
      position?: string;
      department?: string;
      workLocation?: string;
      mentor?: string;
      color?: string;
      gender?: Gender;
      birthDate?: string;
      age?: number;
      bloodType?: string;
      shoeSize?: number;
      sockSize?: string;
      hireDate?: string;
      terminationDate?: string;
      terminationReason?: string;
      yearsAtCompany?: number;
      isActive?: boolean;
      status?: StaffStatus;
    }
  ) {
    // Tarih string'lerini Date'e çevir
    const staffData: Partial<Staff> = {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      terminationDate: dto.terminationDate
        ? new Date(dto.terminationDate)
        : undefined,
    };
    return this.staffService.updatePersonnel(id, staffData);
  }

  // Personel sil (soft delete)
  @Delete("personnel/:id")
  deletePersonnel(@Param("id") id: string) {
    return this.staffService.deletePersonnel(id);
  }

  // Avatar yükle (Base64 - Coolify için)
  @Post("personnel/:id/avatar-base64")
  async uploadPersonnelAvatarBase64(
    @Param("id") id: string,
    @Body() dto: { avatar: string }
  ) {
    if (!dto.avatar) {
      throw new BadRequestException("Avatar verisi gerekli");
    }
    // Base64 formatını kontrol et
    if (!dto.avatar.startsWith("data:image/")) {
      throw new BadRequestException("Geçersiz resim formatı");
    }
    // Boyut kontrolü (yaklaşık 5MB base64 = ~6.6MB string)
    if (dto.avatar.length > 7 * 1024 * 1024) {
      throw new BadRequestException("Dosya boyutu çok büyük (max 5MB)");
    }
    return this.staffService.updatePersonnelAvatar(id, dto.avatar);
  }

  // Avatar yükle (File upload - legacy)
  @Post("personnel/:id/avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: diskStorage({
        destination: "./uploads/avatars",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `avatar-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException("Sadece resim dosyaları yüklenebilir"),
            false
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    })
  )
  async uploadPersonnelAvatar(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException("Dosya yüklenemedi");
    }
    const avatarPath = `/uploads/avatars/${file.filename}`;
    return this.staffService.updatePersonnelAvatar(id, avatarPath);
  }

  // CSV'den toplu personel import et
  @Post("personnel/import-csv")
  importPersonnelFromCSV(@Body() dto: { data: Array<Record<string, string>> }) {
    return this.staffService.importPersonnelFromCSV(dto.data);
  }

  // Users tablosundan Staff tablosuna migration
  @Post("personnel/migrate")
  migrateUsersToStaff() {
    return this.staffService.migrateUsersToStaff();
  }
}
