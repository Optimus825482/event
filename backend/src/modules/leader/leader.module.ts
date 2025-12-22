import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LeaderController } from "./leader.controller";
import { LeaderService } from "./leader.service";
import { User } from "../../entities/user.entity";
import { Event } from "../../entities/event.entity";
import { Team } from "../../entities/team.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";
import { StaffPerformanceReview } from "../../entities/staff-performance-review.entity";
import { TableGroup } from "../../entities/table-group.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Event,
      Team,
      EventStaffAssignment,
      StaffPerformanceReview,
      TableGroup,
    ]),
  ],
  controllers: [LeaderController],
  providers: [LeaderService],
  exports: [LeaderService],
})
export class LeaderModule {}
