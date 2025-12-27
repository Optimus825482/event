import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { User } from "../../entities/user.entity";
import { Event } from "../../entities/event.entity";
import { Team } from "../../entities/team.entity";
import { StaffPerformanceReview } from "../../entities/staff-performance-review.entity";
import { Reservation } from "../../entities/reservation.entity";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Event,
      Team,
      StaffPerformanceReview,
      Reservation,
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
