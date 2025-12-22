import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { LeaderService } from "./leader.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PerformanceRating } from "../../entities/staff-performance-review.entity";

@Controller("leader")
@UseGuards(JwtAuthGuard)
export class LeaderController {
  constructor(private readonly leaderService: LeaderService) {}

  // Leader dashboard
  @Get("dashboard")
  getDashboard(@Request() req: any) {
    return this.leaderService.getDashboard(req.user.id);
  }

  // Etkinlik detayları (takım, masalar, üyeler)
  @Get("events/:eventId")
  getEventDetails(@Request() req: any, @Param("eventId") eventId: string) {
    return this.leaderService.getEventDetails(req.user.id, eventId);
  }

  // Değerlendirme için takım üyelerini getir
  @Get("events/:eventId/team-members")
  getTeamMembersForReview(
    @Request() req: any,
    @Param("eventId") eventId: string
  ) {
    return this.leaderService.getTeamMembersForReview(req.user.id, eventId);
  }

  // Etkinlik için yapılan değerlendirmeleri getir
  @Get("events/:eventId/reviews")
  getEventReviews(@Request() req: any, @Param("eventId") eventId: string) {
    return this.leaderService.getEventReviews(req.user.id, eventId);
  }

  // Tek performans değerlendirmesi
  @Post("reviews")
  createReview(
    @Request() req: any,
    @Body()
    dto: {
      staffId: string;
      eventId: string;
      score: number;
      rating: PerformanceRating;
      comment?: string;
    }
  ) {
    return this.leaderService.createReview(req.user.id, dto);
  }

  // Toplu performans değerlendirmesi
  @Post("events/:eventId/reviews/bulk")
  createBulkReviews(
    @Request() req: any,
    @Param("eventId") eventId: string,
    @Body()
    dto: {
      reviews: Array<{
        staffId: string;
        score: number;
        rating: PerformanceRating;
        comment?: string;
      }>;
    }
  ) {
    return this.leaderService.createBulkReviews(
      req.user.id,
      eventId,
      dto.reviews
    );
  }

  // Personel değerlendirme geçmişi
  @Get("staff/:staffId/reviews")
  getStaffReviews(@Param("staffId") staffId: string) {
    return this.leaderService.getStaffReviews(staffId);
  }
}
