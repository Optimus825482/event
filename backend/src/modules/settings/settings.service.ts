import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SystemSettings, StaffColor } from "../../entities/settings.entity";
import { TableType } from "../../entities/table-type.entity";

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemSettings)
    private settingsRepo: Repository<SystemSettings>,
    @InjectRepository(StaffColor)
    private staffColorRepo: Repository<StaffColor>,
    @InjectRepository(TableType)
    private tableTypeRepo: Repository<TableType>
  ) {}

  // Uygulama başladığında varsayılan ayarları oluştur
  async onModuleInit() {
    await this.ensureDefaultSettings();
    await this.ensureDefaultStaffColors();
    await this.ensureDefaultTableTypes();
  }

  // ============ SYSTEM SETTINGS ============

  async getSettings(): Promise<SystemSettings> {
    const settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      return this.createDefaultSettings();
    }
    return settings;
  }

  async updateSettings(
    updates: Partial<SystemSettings>
  ): Promise<SystemSettings> {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = await this.createDefaultSettings();
    }
    Object.assign(settings, updates);
    return this.settingsRepo.save(settings);
  }

  private async ensureDefaultSettings() {
    const count = await this.settingsRepo.count();
    if (count === 0) {
      await this.createDefaultSettings();
    }
  }

  private async createDefaultSettings(): Promise<SystemSettings> {
    const settings = this.settingsRepo.create({
      companyName: "Test Firması",
      timezone: "Europe/Nicosia",
      language: "tr",
    });
    return this.settingsRepo.save(settings);
  }

  // ============ STAFF COLORS ============

  async getStaffColors(): Promise<StaffColor[]> {
    return this.staffColorRepo.find({ where: { isActive: true } });
  }

  async createStaffColor(data: {
    name: string;
    color: string;
  }): Promise<StaffColor> {
    const staffColor = this.staffColorRepo.create(data);
    return this.staffColorRepo.save(staffColor);
  }

  async updateStaffColor(
    id: string,
    updates: Partial<StaffColor>
  ): Promise<StaffColor | null> {
    await this.staffColorRepo.update(id, updates);
    return this.staffColorRepo.findOne({ where: { id } });
  }

  async deleteStaffColor(id: string): Promise<void> {
    await this.staffColorRepo.update(id, { isActive: false });
  }

  private async ensureDefaultStaffColors() {
    const count = await this.staffColorRepo.count();
    if (count === 0) {
      const defaultColors = [
        { name: "Kırmızı", color: "#ef4444" },
        { name: "Yeşil", color: "#22c55e" },
        { name: "Mavi", color: "#3b82f6" },
        { name: "Sarı", color: "#eab308" },
        { name: "Mor", color: "#8b5cf6" },
        { name: "Turuncu", color: "#f97316" },
        { name: "Pembe", color: "#ec4899" },
        { name: "Cyan", color: "#06b6d4" },
      ];
      for (const color of defaultColors) {
        await this.staffColorRepo.save(this.staffColorRepo.create(color));
      }
    }
  }

  // ============ TABLE TYPES ============

  async getTableTypes(): Promise<TableType[]> {
    return this.tableTypeRepo.find({ where: { isActive: true } });
  }

  async createTableType(data: Partial<TableType>): Promise<TableType> {
    const tableType = this.tableTypeRepo.create(data);
    return this.tableTypeRepo.save(tableType);
  }

  async updateTableType(
    id: string,
    updates: Partial<TableType>
  ): Promise<TableType | null> {
    await this.tableTypeRepo.update(id, updates);
    return this.tableTypeRepo.findOne({ where: { id } });
  }

  async deleteTableType(id: string): Promise<void> {
    await this.tableTypeRepo.update(id, { isActive: false });
  }

  private async ensureDefaultTableTypes() {
    const count = await this.tableTypeRepo.count();
    if (count === 0) {
      const defaultTypes = [
        {
          name: "Standart",
          capacity: 8,
          color: "#3b82f6",
          shape: "round",
          minSpacing: 50,
        },
        {
          name: "VIP",
          capacity: 12,
          color: "#eab308",
          shape: "round",
          minSpacing: 60,
        },
        {
          name: "Premium",
          capacity: 10,
          color: "#8b5cf6",
          shape: "round",
          minSpacing: 55,
        },
        {
          name: "Loca",
          capacity: 15,
          color: "#ef4444",
          shape: "rectangle",
          minSpacing: 80,
        },
      ];
      for (const type of defaultTypes) {
        await this.tableTypeRepo.save(this.tableTypeRepo.create(type));
      }
    }
  }
}
