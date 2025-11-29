import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { TablesService } from './tables.service';
import { CreateTableTypeDto, UpdateTableTypeDto } from './dto';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post('types')
  create(@Body() dto: CreateTableTypeDto) {
    return this.tablesService.create(dto);
  }

  @Get('types')
  findAll() {
    return this.tablesService.findAll();
  }

  @Get('types/:id')
  findOne(@Param('id') id: string) {
    return this.tablesService.findOne(id);
  }

  @Put('types/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTableTypeDto) {
    return this.tablesService.update(id, dto);
  }

  @Delete('types/:id')
  remove(@Param('id') id: string) {
    return this.tablesService.remove(id);
  }

  @Post('seed')
  seed() {
    return this.tablesService.seedDefaults();
  }
}
