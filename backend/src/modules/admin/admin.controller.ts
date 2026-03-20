import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";
import { AdminService } from "./admin.service";

@ApiTags("Admin")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  @ApiOperation({ summary: "Sistem istatistiklerini getir" })
  @ApiResponse({
    status: 200,
    description: "İstatistikler başarıyla getirildi",
  })
  @ApiResponse({ status: 401, description: "Yetkisiz erişim" })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get("events/review-settings")
  @ApiOperation({ summary: "Tüm etkinliklerin değerlendirme ayarlarını getir" })
  @ApiResponse({
    status: 200,
    description: "Ayarlar başarıyla getirildi",
  })
  async getAllEventsReviewSettings() {
    return this.adminService.getAllEventsReviewSettings();
  }

  @Get("events/:eventId/review-settings")
  @ApiOperation({ summary: "Etkinlik değerlendirme ayarlarını getir" })
  @ApiResponse({
    status: 200,
    description: "Ayarlar başarıyla getirildi",
  })
  async getEventReviewSettings(@Param("eventId") eventId: string) {
    return this.adminService.getEventReviewSettings(eventId);
  }

  @Patch("events/:eventId/review-settings")
  @ApiOperation({ summary: "Etkinlik değerlendirme ayarlarını güncelle" })
  @ApiResponse({
    status: 200,
    description: "Ayarlar başarıyla güncellendi",
  })
  async updateEventReviewSettings(
    @Param("eventId") eventId: string,
    @Body()
    settings: { reviewEnabled?: boolean; reviewHistoryVisible?: boolean },
    @Request() req: { user: { id: string } },
  ) {
    return this.adminService.updateEventReviewSettings(
      eventId,
      settings,
      req.user.id,
    );
  }

  @Post("events/review-settings/bulk")
  @ApiOperation({ summary: "Toplu değerlendirme ayarı güncelle" })
  @ApiResponse({
    status: 200,
    description: "Ayarlar başarıyla güncellendi",
  })
  async bulkUpdateReviewSettings(
    @Body()
    body: {
      eventIds: string[];
      settings: { reviewEnabled?: boolean; reviewHistoryVisible?: boolean };
    },
  ) {
    return this.adminService.bulkUpdateReviewSettings(
      body.eventIds,
      body.settings,
    );
  }
}
