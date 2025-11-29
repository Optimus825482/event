import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  findAll() {
    return this.staffService.findAllStaff();
  }

  @Post('assign')
  assignTables(@Body() dto: { eventId: string; staffId: string; tableIds: string[] }) {
    return this.staffService.assignTables(dto.eventId, dto.staffId, dto.tableIds);
  }

  @Get('event/:eventId')
  getEventAssignments(@Param('eventId') eventId: string) {
    return this.staffService.getEventAssignments(eventId);
  }

  @Get('event/:eventId/staff/:staffId')
  getStaffTables(
    @Param('eventId') eventId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.staffService.getStaffTables(eventId, staffId);
  }
}
