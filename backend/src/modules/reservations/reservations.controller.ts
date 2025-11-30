import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  SetMetadata,
} from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import {
  CreateReservationDto,
  UpdateReservationDto,
  ReservationFiltersDto,
} from "./dto/reservation.dto";
import { ReservationStatus } from "../../entities/reservation.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

// Public decorator - check-in endpoint'leri için auth bypass
const IS_PUBLIC_KEY = "isPublic";
const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller("reservations")
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  /**
   * Tüm rezervasyonları getir - Arama ve filtreleme destekli
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  @Get()
  findAll(
    @Query("eventId") eventId?: string,
    @Query("customerId") customerId?: string,
    @Query("status") status?: ReservationStatus,
    @Query("searchQuery") searchQuery?: string,
    @Query("tableId") tableId?: string
  ) {
    const filters: ReservationFiltersDto = {
      eventId,
      customerId,
      status,
      searchQuery,
      tableId,
    };
    return this.reservationsService.findAll(filters);
  }

  /**
   * Rezervasyon ara - İsim veya telefon ile
   * Requirements: 7.1, 7.2 - Partial match, case-insensitive
   */
  @Get("search")
  search(@Query("q") searchQuery: string, @Query("eventId") eventId?: string) {
    return this.reservationsService.search(searchQuery, eventId);
  }

  /**
   * Rezervasyonları filtrele - Status ve event bazlı
   * Requirements: 7.3, 7.4 - Birden fazla filtre kombinasyonu
   */
  @Get("filter")
  filter(
    @Query("status") status?: ReservationStatus,
    @Query("eventId") eventId?: string,
    @Query("tableId") tableId?: string
  ) {
    return this.reservationsService.filter({ status, eventId, tableId });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.reservationsService.findOne(id);
  }

  @Get(":id/qrcode")
  generateQRCode(@Param("id") id: string) {
    return this.reservationsService.generateQRCode(id);
  }

  @Put(":id")
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
  getByQRCode(@Param("qrCodeHash") qrCodeHash: string) {
    return this.reservationsService.getReservationByQRCode(qrCodeHash);
  }

  /**
   * QR kod ile check-in yap
   * Requirements: 4.2, 4.3, 4.4
   * Public: Kiosk/tablet modunda auth gerekmez
   */
  @Public()
  @Post("check-in/:qrCodeHash")
  checkIn(@Param("qrCodeHash") qrCodeHash: string) {
    return this.reservationsService.checkIn(qrCodeHash);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.reservationsService.cancel(id);
  }

  /**
   * Event istatistiklerini getir - Dashboard için
   * Requirement: 5.1 - totalExpected, checkedIn, remaining, cancelled, noShow
   */
  @Get("event/:eventId/stats")
  getEventStats(@Param("eventId") eventId: string) {
    return this.reservationsService.getEventStats(eventId);
  }

  @Get("event/:eventId/table/:tableId")
  getByTable(
    @Param("eventId") eventId: string,
    @Param("tableId") tableId: string
  ) {
    return this.reservationsService.getByTable(eventId, tableId);
  }

  @Get("event/:eventId/table/:tableId/available")
  isTableAvailable(
    @Param("eventId") eventId: string,
    @Param("tableId") tableId: string
  ) {
    return this.reservationsService.isTableAvailable(eventId, tableId);
  }

  /**
   * Müşteri geçmişi getir - CRM Entegrasyonu
   * Requirement: 6.1 - VIP score ve event geçmişi
   */
  @Get("customer/:customerId/history")
  getCustomerHistory(@Param("customerId") customerId: string) {
    return this.reservationsService.getCustomerHistory(customerId);
  }

  /**
   * Blacklist kontrolü - CRM Entegrasyonu
   * Requirement: 6.2 - Kara liste uyarısı
   */
  @Get("customer/:customerId/blacklist-status")
  checkBlacklistStatus(@Param("customerId") customerId: string) {
    return this.reservationsService.checkBlacklistStatus(customerId);
  }

  /**
   * Müşteri bilgilerini rezervasyon için getir - CRM Entegrasyonu
   * Requirements: 6.1, 6.2, 6.3 - Tüm müşteri bilgileri tek seferde
   */
  @Get("customer/:customerId/info")
  getCustomerInfoForReservation(@Param("customerId") customerId: string) {
    return this.reservationsService.getCustomerInfoForReservation(customerId);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.reservationsService.delete(id);
  }
}
