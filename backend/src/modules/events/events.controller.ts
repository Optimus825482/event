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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { EventStatus } from "../../entities/event.entity";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

@ApiTags("Events")
@ApiBearerAuth("JWT-auth")
@Controller("events")
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: "Yeni etkinlik oluştur" })
  create(@Body() dto: CreateEventDto, @Request() req) {
    const userId = req.user.id;
    return this.eventsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: "Tüm etkinlikleri listele" })
  @ApiQuery({
    name: "all",
    required: false,
    description: "Tüm etkinlikleri getir",
  })
  findAll(@Request() req, @Query("all") all: string) {
    const userId = req.user?.id;
    return this.eventsService.findAll(all === "true" ? undefined : userId);
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
}
