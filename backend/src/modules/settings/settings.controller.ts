import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { MailService } from "../mail/mail.service";

// TODO: Production'da JwtAuthGuard eklenecek
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mailService: MailService
  ) {}

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

  @Get("staff-colors")
  async getStaffColors() {
    return this.settingsService.getStaffColors();
  }

  @Post("staff-colors")
  async createStaffColor(@Body() data: { name: string; color: string }) {
    return this.settingsService.createStaffColor(data);
  }

  @Put("staff-colors/:id")
  async updateStaffColor(@Param("id") id: string, @Body() updates: any) {
    return this.settingsService.updateStaffColor(id, updates);
  }

  @Delete("staff-colors/:id")
  async deleteStaffColor(@Param("id") id: string) {
    return this.settingsService.deleteStaffColor(id);
  }

  // ============ TABLE TYPES ============

  @Get("table-types")
  async getTableTypes() {
    return this.settingsService.getTableTypes();
  }

  @Post("table-types")
  async createTableType(@Body() data: any) {
    return this.settingsService.createTableType(data);
  }

  @Put("table-types/:id")
  async updateTableType(@Param("id") id: string, @Body() updates: any) {
    return this.settingsService.updateTableType(id, updates);
  }

  @Delete("table-types/:id")
  async deleteTableType(@Param("id") id: string) {
    return this.settingsService.deleteTableType(id);
  }

  // ============ SMTP / MAIL ============

  @Post("smtp/test")
  async testSmtpConnection() {
    return this.mailService.testConnection();
  }

  @Post("smtp/test-email")
  async sendTestEmail(@Body() body: { email: string }) {
    return this.mailService.sendMail({
      to: body.email,
      subject: "🧪 EventFlow PRO - SMTP Test",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2563eb;">✅ SMTP Bağlantısı Başarılı!</h2>
          <p>Bu e-posta EventFlow PRO sisteminden gönderilmiştir.</p>
          <p style="color: #6b7280; font-size: 12px;">Test zamanı: ${new Date().toLocaleString(
            "tr-TR"
          )}</p>
        </div>
      `,
      text: "SMTP Bağlantısı Başarılı! Bu e-posta EventFlow PRO sisteminden gönderilmiştir.",
    });
  }
}
