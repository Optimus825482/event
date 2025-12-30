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
  Staff,
} from "../../entities";
import { Position } from "../../entities/position.entity";
import { Department } from "../../entities/department.entity";
import { WorkLocation } from "../../entities/work-location.entity";
import { DepartmentPosition } from "../../entities/department-position.entity";
import { DepartmentLocation } from "../../entities/department-location.entity";
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
      Staff,
      Position,
      Department,
      WorkLocation,
      DepartmentPosition,
      DepartmentLocation,
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
