import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { SettingsService } from './settings.service';

// TODO: Production'da JwtAuthGuard eklenecek
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ============ SYSTEM SETTINGS ============

  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() updates: any) {
    return this.settingsService.updateSettings(updates);
  }

  // ============ STAFF COLORS ============

  @Get('staff-colors')
  async getStaffColors() {
    return this.settingsService.getStaffColors();
  }

  @Post('staff-colors')
  async createStaffColor(@Body() data: { name: string; color: string }) {
    return this.settingsService.createStaffColor(data);
  }

  @Put('staff-colors/:id')
  async updateStaffColor(@Param('id') id: string, @Body() updates: any) {
    return this.settingsService.updateStaffColor(id, updates);
  }

  @Delete('staff-colors/:id')
  async deleteStaffColor(@Param('id') id: string) {
    return this.settingsService.deleteStaffColor(id);
  }

  // ============ TABLE TYPES ============

  @Get('table-types')
  async getTableTypes() {
    return this.settingsService.getTableTypes();
  }

  @Post('table-types')
  async createTableType(@Body() data: any) {
    return this.settingsService.createTableType(data);
  }

  @Put('table-types/:id')
  async updateTableType(@Param('id') id: string, @Body() updates: any) {
    return this.settingsService.updateTableType(id, updates);
  }

  @Delete('table-types/:id')
  async deleteTableType(@Param('id') id: string) {
    return this.settingsService.deleteTableType(id);
  }
}
