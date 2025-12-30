import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  SetMetadata,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { EventsService } from "./events.service";
import {
  CreateEventDto,
  UpdateEventDto,
  UpdateLayoutDto,
} from "./dto/event.dto";
import {
  CreateEventExtraStaffDto,
  UpdateEventExtraStaffDto,
  BulkSaveEventExtraStaffDto,
} from "./dto/event-extra-staff.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { EventStatus } from "../../entities/event.entity";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

// Public decorator - check-in endpoint'leri için auth bypass
const IS_PUBLIC_KEY = "isPublic";
const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags("Events")
@ApiBearerAuth("JWT-auth")
@Controller("events")
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private eventsService: EventsService) {}

  /**
   * Bugünün aktif etkinliklerini getir - Check-in modülü için
   * Public: Kiosk/tablet modunda auth gerekmez
   */
  @Public()
  @Get("active/today")
  @ApiOperation({ summary: "Bugünün aktif etkinlikleri (Public)" })
  getActiveEventsToday() {
    return this.eventsService.getActiveEventsToday();
  }

  @Post()
  @ApiOperation({ summary: "Yeni etkinlik oluştur" })
  create(@Body() dto: CreateEventDto, @Request() req) {
    const userId = req.user.id;
    return this.eventsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: "Tüm etkinlikleri listele (paginated)" })
  @ApiQuery({
    name: "all",
    required: false,
    description: "Tüm etkinlikleri getir",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Sayfa numarası (default: 1)",
    type: Number,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Sayfa başına kayıt sayısı (default: 50, max: 100)",
    type: Number,
  })
  findAll(
    @Request() req,
    @Query("all") all: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    const userId = req.user?.id;
    const pageNum = page && page > 0 ? page : 1;
    const limitNum = limit && limit > 0 && limit <= 100 ? limit : 50;

    return this.eventsService.findAll(
      all === "true" ? undefined : userId,
      pageNum,
      limitNum
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Etkinlik detayı getir" })
  findOne(@Param("id") id: string) {
    return this.eventsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Etkinlik güncelle" })
  update(@Param("id") id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Patch(":id/layout")
  @ApiOperation({ summary: "Etkinlik yerleşim planını güncelle" })
  updateLayout(
    @Param("id") id: string,
    @Body() dto: UpdateLayoutDto,
    @Request() req
  ) {
    const userId = req.user?.id;
    return this.eventsService.updateLayout(id, dto, userId);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Etkinlik durumunu güncelle" })
  updateStatus(@Param("id") id: string, @Body("status") status: EventStatus) {
    return this.eventsService.updateStatus(id, status);
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Etkinlik istatistikleri" })
  getStats(@Param("id") id: string) {
    return this.eventsService.getStats(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Etkinlik sil" })
  delete(@Param("id") id: string) {
    return this.eventsService.delete(id);
  }

  // ==================== EKSTRA PERSONEL ENDPOINTS ====================

  @Get(":id/extra-staff")
  @ApiOperation({ summary: "Etkinliğin ekstra personellerini getir" })
  getExtraStaff(@Param("id") id: string) {
    return this.eventsService.getExtraStaff(id);
  }

  @Post(":id/extra-staff")
  @ApiOperation({ summary: "Ekstra personel ekle" })
  createExtraStaff(
    @Param("id") id: string,
    @Body() dto: CreateEventExtraStaffDto
  ) {
    return this.eventsService.createExtraStaff(id, dto);
  }

  @Put(":id/extra-staff/:extraStaffId")
  @ApiOperation({ summary: "Ekstra personel güncelle" })
  updateExtraStaff(
    @Param("id") id: string,
    @Param("extraStaffId") extraStaffId: string,
    @Body() dto: UpdateEventExtraStaffDto
  ) {
    return this.eventsService.updateExtraStaff(id, extraStaffId, dto);
  }

  @Delete(":id/extra-staff/:extraStaffId")
  @ApiOperation({ summary: "Ekstra personel sil" })
  deleteExtraStaff(
    @Param("id") id: string,
    @Param("extraStaffId") extraStaffId: string
  ) {
    return this.eventsService.deleteExtraStaff(id, extraStaffId);
  }

  @Post(":id/extra-staff/bulk")
  @ApiOperation({ summary: "Toplu ekstra personel kaydet" })
  saveExtraStaffBulk(
    @Param("id") id: string,
    @Body() dto: BulkSaveEventExtraStaffDto
  ) {
    return this.eventsService.saveExtraStaffBulk(id, dto.extraStaff);
  }
}
