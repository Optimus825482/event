import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ReservationsService } from "./reservations.service";
import { CheckInService } from "./check-in.service";
import { ReservationCrmService } from "./reservation-crm.service";
import { ReservationStatsService } from "./reservation-stats.service";
import {
  CreateReservationDto,
  UpdateReservationDto,
  ReservationFiltersDto,
  WalkInDto,
  UpdateGuestCountDto,
} from "./dto/reservation.dto";
import { ReservationStatus } from "../../entities/reservation.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Public } from "../auth/decorators/public.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { SettingsService } from "../settings/settings.service";
import { Throttle } from "@nestjs/throttler";

@ApiTags("Reservations")
@ApiBearerAuth("JWT-auth")
@Controller("reservations")
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(
    private reservationsService: ReservationsService,
    private checkInService: CheckInService,
    private crmService: ReservationCrmService,
    private statsService: ReservationStatsService,
    private settingsService: SettingsService,
  ) {}

  private async ensureQrCodeEnabled(): Promise<void> {
    const settings = await this.settingsService.getSettings();
    if (!settings.qrCodeSystemEnabled) {
      throw new ForbiddenException(
        "QR kod sistemi şu anda devre dışı. Sistem ayarlarından aktif edebilirsiniz.",
      );
    }
  }

  @Post()
  @ApiOperation({ summary: "Yeni rezervasyon oluştur" })
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  /**
   * Tüm rezervasyonları getir - Arama ve filtreleme destekli
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  @Get()
  @ApiOperation({ summary: "Tüm rezervasyonları listele" })
  @ApiQuery({ name: "eventId", required: false })
  @ApiQuery({ name: "customerId", required: false })
  @ApiQuery({ name: "status", required: false, enum: ReservationStatus })
  @ApiQuery({ name: "searchQuery", required: false })
  @ApiQuery({ name: "tableId", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @Query("eventId") eventId?: string,
    @Query("customerId") customerId?: string,
    @Query("status") status?: ReservationStatus,
    @Query("searchQuery") searchQuery?: string,
    @Query("tableId") tableId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    const filters: ReservationFiltersDto = {
      eventId,
      customerId,
      status,
      searchQuery,
      tableId,
    };
    const pageNum = page && page > 0 ? +page : 1;
    const limitNum = limit && limit > 0 && limit <= 100 ? +limit : 50;
    return this.reservationsService.findAll(filters, pageNum, limitNum);
  }

  /**
   * Rezervasyon ara - İsim veya telefon ile
   * Requirements: 7.1, 7.2 - Partial match, case-insensitive
   */
  @Get("search")
  @ApiOperation({ summary: "Rezervasyon ara" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  search(
    @Query("q") searchQuery: string,
    @Query("eventId") eventId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    const pageNum = page && page > 0 ? +page : 1;
    const limitNum = limit && limit > 0 && limit <= 100 ? +limit : 50;
    return this.reservationsService.search(
      searchQuery,
      eventId,
      pageNum,
      limitNum,
    );
  }

  /**
   * Rezervasyonları filtrele - Status ve event bazlı
   * Requirements: 7.3, 7.4 - Birden fazla filtre kombinasyonu
   */
  @Get("filter")
  @ApiOperation({ summary: "Rezervasyonları filtrele" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  filter(
    @Query("status") status?: ReservationStatus,
    @Query("eventId") eventId?: string,
    @Query("tableId") tableId?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    const pageNum = page && page > 0 ? +page : 1;
    const limitNum = limit && limit > 0 && limit <= 100 ? +limit : 50;
    return this.reservationsService.filter(
      { status, eventId, tableId },
      pageNum,
      limitNum,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Rezervasyon detayı" })
  findOne(@Param("id") id: string) {
    return this.reservationsService.findOne(id);
  }

  @Get(":id/qrcode")
  @ApiOperation({ summary: "Rezervasyon QR kodu oluştur" })
  async generateQRCode(@Param("id") id: string) {
    await this.ensureQrCodeEnabled();
    return this.reservationsService.generateQRCode(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Rezervasyon güncelle" })
  update(@Param("id") id: string, @Body() dto: UpdateReservationDto) {
    return this.reservationsService.update(id, dto);
  }

  /**
   * QR kod ile rezervasyon detaylarını getir
   * Requirement: 4.1 - Check-in öncesi doğrulama için
   * Public: Kiosk/tablet modunda auth gerekmez
   */
  @Public()
  @Get("qr/:qrCodeHash")
  @ApiOperation({ summary: "QR kod ile rezervasyon getir (Public)" })
  async getByQRCode(@Param("qrCodeHash") qrCodeHash: string) {
    await this.ensureQrCodeEnabled();
    return this.checkInService.getReservationByQRCode(qrCodeHash);
  }

  /**
   * QR kod ile check-in yap
   * Requirements: 4.2, 4.3, 4.4
   * Public: Kiosk/tablet modunda auth gerekmez
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("check-in/:qrCodeHash")
  @ApiOperation({ summary: "QR kod ile check-in (Public)" })
  async checkIn(@Param("qrCodeHash") qrCodeHash: string) {
    await this.ensureQrCodeEnabled();
    return this.checkInService.checkIn(qrCodeHash);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Rezervasyon iptal et" })
  cancel(@Param("id") id: string) {
    return this.reservationsService.cancel(id);
  }

  /**
   * Event istatistiklerini getir - Dashboard için
   * Requirement: 5.1 - totalExpected, checkedIn, remaining, cancelled, noShow
   */
  @Get("event/:eventId/stats")
  @ApiOperation({ summary: "Etkinlik rezervasyon istatistikleri" })
  getEventStats(@Param("eventId") eventId: string) {
    return this.statsService.getEventStats(eventId);
  }

  @Get("event/:eventId/table/:tableId")
  @ApiOperation({ summary: "Masa rezervasyonları" })
  getByTable(
    @Param("eventId") eventId: string,
    @Param("tableId") tableId: string,
  ) {
    return this.statsService.getByTable(eventId, tableId);
  }

  @Get("event/:eventId/table/:tableId/available")
  @ApiOperation({ summary: "Masa müsaitlik kontrolü" })
  isTableAvailable(
    @Param("eventId") eventId: string,
    @Param("tableId") tableId: string,
  ) {
    return this.reservationsService.isTableAvailable(eventId, tableId);
  }

  /**
   * Müşteri geçmişi - CRM Entegrasyonu
   * Requirement: 6.1 - VIP score ve event geçmişi
   */
  @Get("customer/:customerId/history")
  @ApiOperation({ summary: "Müşteri rezervasyon geçmişi" })
  getCustomerHistory(@Param("customerId") customerId: string) {
    return this.crmService.getCustomerHistory(customerId);
  }

  /**
   * Blacklist kontrolü - CRM Entegrasyonu
   * Requirement: 6.2 - Kara liste uyarısı
   */
  @Get("customer/:customerId/blacklist-status")
  @ApiOperation({ summary: "Müşteri kara liste durumu" })
  checkBlacklistStatus(@Param("customerId") customerId: string) {
    return this.crmService.checkBlacklistStatus(customerId);
  }

  /**
   * Müşteri bilgilerini rezervasyon için getir - CRM Entegrasyonu
   * Requirements: 6.1, 6.2, 6.3 - Tüm müşteri bilgileri tek seferde
   */
  @Get("customer/:customerId/info")
  @ApiOperation({ summary: "Müşteri rezervasyon bilgileri" })
  getCustomerInfoForReservation(@Param("customerId") customerId: string) {
    return this.crmService.getCustomerInfoForReservation(customerId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Rezervasyon sil" })
  delete(@Param("id") id: string) {
    return this.reservationsService.delete(id);
  }

  // ==================== CHECK-IN MODULE ENDPOINTS ====================

  /**
   * Check-in için etkinlik verilerini getir
   * Event detayları, rezervasyonlar ve istatistikler
   * Requirement: Check-in Module 1.1, 1.2
   */
  @Public()
  @Get("event/:eventId/check-in-data")
  @ApiOperation({ summary: "Check-in için etkinlik verileri (Public)" })
  getEventForCheckIn(@Param("eventId") eventId: string) {
    return this.checkInService.getEventForCheckIn(eventId);
  }

  /**
   * Check-in geçmişi - Son check-in'ler
   * Requirement: Check-in Module 6.1, 6.2
   */
  @Public()
  @Get("event/:eventId/check-in-history")
  @ApiOperation({ summary: "Check-in geçmişi (Public)" })
  getCheckInHistory(
    @Param("eventId") eventId: string,
    @Query("limit") limit?: string,
  ) {
    return this.checkInService.getCheckInHistory(
      eventId,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Müsait masaları getir - Walk-in için
   * Requirement: Check-in Module 11.3
   */
  @Public()
  @Get("event/:eventId/available-tables")
  @ApiOperation({ summary: "Müsait masalar (Public)" })
  getAvailableTables(@Param("eventId") eventId: string) {
    return this.checkInService.getAvailableTables(eventId);
  }

  /**
   * Walk-in misafir kaydı
   * Requirement: Check-in Module 11.1, 11.2, 11.4
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("walk-in")
  @ApiOperation({ summary: "Walk-in misafir kaydı (Public)" })
  registerWalkIn(@Body() dto: WalkInDto) {
    return this.checkInService.registerWalkIn(dto);
  }

  /**
   * Kişi sayısı güncelle
   * Requirement: Check-in Module 12.1
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch(":id/guest-count")
  @ApiOperation({ summary: "Kişi sayısı güncelle (Public)" })
  updateGuestCount(@Param("id") id: string, @Body() dto: UpdateGuestCountDto) {
    return this.checkInService.updateGuestCount(id, dto.guestCount);
  }

  // ==================== ADMIN OPERATIONS ====================

  /**
   * Gelmeyen misafirleri NO_SHOW olarak işaretle
   * Event bittikten sonra PENDING/CONFIRMED → NO_SHOW
   */
  @Post("event/:eventId/mark-no-shows")
  @ApiOperation({ summary: "Gelmeyen misafirleri NO_SHOW olarak işaretle" })
  markNoShows(@Param("eventId") eventId: string) {
    return this.reservationsService.markNoShows(eventId);
  }
}
