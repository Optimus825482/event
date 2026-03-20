import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { LeaderService } from "./leader.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";
import {
  AutoSaveReviewDto,
  CreateReviewDto,
  CreateBulkReviewsDto,
} from "./dto/leader.dto";

@ApiTags("Leader")
@ApiBearerAuth()
@Controller("leader")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LEADER, UserRole.ORGANIZER, UserRole.ADMIN)
export class LeaderController {
  constructor(private readonly leaderService: LeaderService) {}

  // Leader dashboard
  @Get("dashboard")
  getDashboard(@Request() req: { user: { id: string } }) {
    return this.leaderService.getDashboard(req.user.id);
  }

  // Etkinlik detayları (takım, masalar, üyeler)
  @Get("events/:eventId")
  getEventDetails(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
  ) {
    return this.leaderService.getEventDetails(req.user.id, eventId);
  }

  // Etkinlik review izinlerini kontrol et
  @Get("events/:eventId/review-permissions")
  getEventReviewPermissions(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
  ) {
    return this.leaderService.getEventReviewPermissions(req.user.id, eventId);
  }

  // Değerlendirme için takım üyelerini getir
  @Get("events/:eventId/team-members")
  getTeamMembersForReview(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
  ) {
    return this.leaderService.getTeamMembersForReview(req.user.id, eventId);
  }

  // Etkinlik için yapılan değerlendirmeleri getir
  @Get("events/:eventId/reviews")
  getEventReviews(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
  ) {
    return this.leaderService.getEventReviews(req.user.id, eventId);
  }

  // Etkinlik performans özeti
  @Get("events/:eventId/performance-summary")
  getEventPerformanceSummary(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
  ) {
    return this.leaderService.getEventPerformanceSummary(req.user.id, eventId);
  }

  // Auto-save: Anlık değerlendirme kaydetme
  @Post("reviews/auto-save")
  autoSaveReview(
    @Request() req: { user: { id: string } },
    @Body() dto: AutoSaveReviewDto,
  ) {
    return this.leaderService.autoSaveReview(req.user.id, dto);
  }

  // Tek performans değerlendirmesi
  @Post("reviews")
  createReview(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateReviewDto,
  ) {
    return this.leaderService.createReview(req.user.id, dto);
  }

  // Toplu performans değerlendirmesi
  @Post("events/:eventId/reviews/bulk")
  createBulkReviews(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
    @Body() dto: CreateBulkReviewsDto,
  ) {
    return this.leaderService.createBulkReviews(
      req.user.id,
      eventId,
      dto.reviews,
    );
  }

  // Tek değerlendirmeyi tamamla
  @Patch("events/:eventId/reviews/:staffId/complete")
  completeReview(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
    @Param("staffId") staffId: string,
  ) {
    return this.leaderService.completeReview(req.user.id, eventId, staffId);
  }

  // Tüm değerlendirmeleri tamamla
  @Patch("events/:eventId/reviews/complete-all")
  completeAllReviews(
    @Request() req: { user: { id: string } },
    @Param("eventId") eventId: string,
  ) {
    return this.leaderService.completeAllReviews(req.user.id, eventId);
  }

  // Personel değerlendirme geçmişi
  @Get("staff/:staffId/reviews")
  getStaffReviews(@Param("staffId") staffId: string) {
    return this.leaderService.getStaffReviews(staffId);
  }

  // Personel performans analizi
  @Get("staff/:staffId/performance-analysis")
  getStaffPerformanceAnalysis(@Param("staffId") staffId: string) {
    return this.leaderService.getStaffPerformanceAnalysis(staffId);
  }

  // Tüm personellerin değerlendirme özetleri
  @Get("staff-reviews-summary")
  getAllStaffReviewsSummary() {
    return this.leaderService.getAllStaffReviewsSummary();
  }

  // Personelin atandığı etkinlikler ve değerlendirmeleri
  @Get("staff/:staffId/event-reviews")
  getStaffEventReviews(@Param("staffId") staffId: string) {
    return this.leaderService.getStaffEventReviews(staffId);
  }
}
