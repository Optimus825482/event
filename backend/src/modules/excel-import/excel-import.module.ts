import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExcelImportService } from "./excel-import.service";
import { ExcelImportController } from "./excel-import.controller";
import { AIExcelParserService } from "./ai-excel-parser.service";
import { ExcelConverterService } from "./excel-converter.service";
import { ReservationImportService } from "./reservation-import.service";
import { StaffMatcherService } from "./staff-matcher.service";
import { ExcelParserService } from "./excel-parser.service";
import { ExcelResultMergerService } from "./excel-result-merger.service";
import { Staff } from "../../entities/staff.entity";
import { Event } from "../../entities/event.entity";
import { TableGroup } from "../../entities/table-group.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";
import { Reservation } from "../../entities/reservation.entity";
import { Customer } from "../../entities/customer.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Staff,
      Event,
      TableGroup,
      EventStaffAssignment,
      Reservation,
      Customer,
    ]),
  ],
  controllers: [ExcelImportController],
  providers: [
    ExcelImportService,
    AIExcelParserService,
    ExcelConverterService,
    ReservationImportService,
    StaffMatcherService,
    ExcelParserService,
    ExcelResultMergerService,
  ],
  exports: [
    ExcelImportService,
    AIExcelParserService,
    ExcelConverterService,
    ReservationImportService,
  ],
})
export class ExcelImportModule {}
