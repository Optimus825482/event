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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ReservationsService } from "./reservations.service";
import {
  CreateReservationDto,
  UpdateReservationDto,
  ReservationFiltersDto,
} from "./dto/reservation.dto";
import { ReservationStatus } from "../../entities/reservation.entity";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

// Public decorator - check-in endpoint'leri için auth bypass
const IS_PUBLIC_KEY = "isPublic";
const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags("Reservations")
@ApiBearerAuth("JWT-auth")
@Controller("reservations")
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

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
  @ApiOperation({ summary: "Rezervasyon ara" })
  search(@Query("q") searchQuery: string, @Query("eventId") eventId?: string) {
    return this.reservationsService.search(searchQuery, eventId);
  }

  /**
   * Rezervasyonları filtrele - Status ve event bazlı
   * Requirements: 7.3, 7.4 - Birden fazla filtre kombinasyonu
   */
  @Get("filter")
  @ApiOperation({ summary: "Rezervasyonları filtrele" })
  filter(
    @Query("status") status?: ReservationStatus,
    @Query("eventId") eventId?: string,
    @Query("tableId") tableId?: string
  ) {
    return this.reservationsService.filter({ status, eventId, tableId });
  }

  @Get(":id")
  @ApiOperation({ summary: "Rezervasyon detayı" })
  findOne(@Param("id") id: string) {
    return this.reservationsService.findOne(id);
  }

  @Get(":id/qrcode")
  @ApiOperation({ summary: "Rezervasyon QR kodu oluştur" })
  generateQRCode(@Param("id") id: string) {
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
  @ApiOperation({ summary: "QR kod ile check-in (Public)" })
  checkIn(@Param("qrCodeHash") qrCodeHash: string) {
    return this.reservationsService.checkIn(qrCodeHash);
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
    return this.reservationsService.getEventStats(eventId);
  }

  @Get("event/:eventId/table/:tableId")
  @ApiOperation({ summary: "Masa rezervasyonları" })
  getByTable(
    @Param("eventId") eventId: string,
    @Param("tableId") tableId: string
  ) {
    return this.reservationsService.getByTable(eventId, tableId);
  }

  @Get("event/:eventId/table/:tableId/available")
  @ApiOperation({ summary: "Masa müsaitlik kontrolü" })
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
  @ApiOperation({ summary: "Müşteri rezervasyon geçmişi" })
  getCustomerHistory(@Param("customerId") customerId: string) {
    return this.reservationsService.getCustomerHistory(customerId);
  }

  /**
   * Blacklist kontrolü - CRM Entegrasyonu
   * Requirement: 6.2 - Kara liste uyarısı
   */
  @Get("customer/:customerId/blacklist-status")
  @ApiOperation({ summary: "Müşteri kara liste durumu" })
  checkBlacklistStatus(@Param("customerId") customerId: string) {
    return this.reservationsService.checkBlacklistStatus(customerId);
  }

  /**
   * Müşteri bilgilerini rezervasyon için getir - CRM Entegrasyonu
   * Requirements: 6.1, 6.2, 6.3 - Tüm müşteri bilgileri tek seferde
   */
  @Get("customer/:customerId/info")
  @ApiOperation({ summary: "Müşteri rezervasyon bilgileri" })
  getCustomerInfoForReservation(@Param("customerId") customerId: string) {
    return this.reservationsService.getCustomerInfoForReservation(customerId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Rezervasyon sil" })
  delete(@Param("id") id: string) {
    return this.reservationsService.delete(id);
  }
}
