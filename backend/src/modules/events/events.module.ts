import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { ServicePointsController } from "./service-points.controller";
import { ServicePointsService } from "./service-points.service";
import { Event } from "../../entities/event.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";
import { EventExtraStaff } from "../../entities/event-extra-staff.entity";
import { ServicePoint } from "../../entities/service-point.entity";
import { ServicePointStaffAssignment } from "../../entities/service-point-staff-assignment.entity";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      EventStaffAssignment,
      EventExtraStaff,
      ServicePoint,
      ServicePointStaffAssignment,
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [EventsController, ServicePointsController],
  providers: [EventsService, ServicePointsService],
  exports: [EventsService, ServicePointsService],
})
export class EventsModule {}
