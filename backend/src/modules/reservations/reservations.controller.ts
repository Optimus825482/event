import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, UpdateReservationDto } from './dto/reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  @Get()
  findAll(@Query('eventId') eventId: string) {
    return this.reservationsService.findAll(eventId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }

  @Get(':id/qrcode')
  generateQRCode(@Param('id') id: string) {
    return this.reservationsService.generateQRCode(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReservationDto) {
    return this.reservationsService.update(id, dto);
  }

  @Post('check-in/:qrCodeHash')
  checkIn(@Param('qrCodeHash') qrCodeHash: string) {
    return this.reservationsService.checkIn(qrCodeHash);
  }

  @Get('event/:eventId/table/:tableId')
  getByTable(@Param('eventId') eventId: string, @Param('tableId') tableId: string) {
    return this.reservationsService.getByTable(eventId, tableId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.reservationsService.delete(id);
  }
}
