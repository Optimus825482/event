import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffService } from "./staff.service";
import { StaffController } from "./staff.controller";
import {
  StaffAssignment,
  User,
  Event,
  ServiceTeam,
  TableGroup,
  StaffRole,
  WorkShift,
  Team,
  EventStaffAssignment,
  OrganizationTemplate,
} from "../../entities";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffAssignment,
      User,
      Event,
      ServiceTeam,
      TableGroup,
      StaffRole,
      WorkShift,
      Team,
      EventStaffAssignment,
      OrganizationTemplate,
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
