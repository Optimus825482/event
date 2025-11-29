import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, UpdateLayoutDto } from './dto/event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventStatus } from '../../entities/event.entity';

@Controller('events')
// @UseGuards(JwtAuthGuard) // TODO: Development için geçici olarak kapatıldı
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto, @Request() req) {
    // Development: req.user yoksa varsayılan kullanıcı ID'si kullan
    const userId = req.user?.id || 'dev-user-id';
    return this.eventsService.create(dto, userId);
  }

  @Get()
  findAll(@Request() req, @Query('all') all: string) {
    // Development: tüm etkinlikleri getir
    const userId = req.user?.id;
    return this.eventsService.findAll(all === 'true' ? undefined : userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Patch(':id/layout')
  updateLayout(@Param('id') id: string, @Body() dto: UpdateLayoutDto) {
    return this.eventsService.updateLayout(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: EventStatus) {
    return this.eventsService.updateStatus(id, status);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.eventsService.getStats(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.eventsService.delete(id);
  }
}
