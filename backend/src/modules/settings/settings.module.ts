import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SystemSettings, StaffColor } from '../../entities/settings.entity';
import { TableType } from '../../entities/table-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings, StaffColor, TableType])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
