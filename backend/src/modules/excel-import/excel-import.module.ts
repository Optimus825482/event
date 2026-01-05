import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExcelImportService } from "./excel-import.service";
import { ExcelImportController } from "./excel-import.controller";
import { AIExcelParserService } from "./ai-excel-parser.service";
import { ExcelConverterService } from "./excel-converter.service";
import { Staff } from "../../entities/staff.entity";
import { Event } from "../../entities/event.entity";
import { TableGroup } from "../../entities/table-group.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Staff, Event, TableGroup, EventStaffAssignment]),
  ],
  controllers: [ExcelImportController],
  providers: [ExcelImportService, AIExcelParserService, ExcelConverterService],
  exports: [ExcelImportService, AIExcelParserService, ExcelConverterService],
})
export class ExcelImportModule {}
