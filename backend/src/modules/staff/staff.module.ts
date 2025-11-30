import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffService } from "./staff.service";
import { StaffController } from "./staff.controller";
import { StaffAssignment, User, Event, ServiceTeam } from "../../entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffAssignment, User, Event, ServiceTeam]),
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
