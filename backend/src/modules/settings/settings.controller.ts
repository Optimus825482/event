import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";
import { SettingsService } from "./settings.service";
import { MailService } from "../mail/mail.service";

@ApiTags("Settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ORGANIZER)
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mailService: MailService
  ) {}

  // ============ SYSTEM SETTINGS ============

  @Get()
  @ApiOperation({ summary: "Tüm sistem ayarlarını getir" })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: "Sistem ayarlarını güncelle" })
  async updateSettings(@Body() updates: any) {
    return this.settingsService.updateSettings(updates);
  }

  // ============ STAFF COLORS ============

  @Get("staff-colors")
  @ApiOperation({ summary: "Personel renk listesini getir" })
  async getStaffColors() {
    return this.settingsService.getStaffColors();
  }

  @Post("staff-colors")
  @ApiOperation({ summary: "Yeni personel rengi ekle" })
  async createStaffColor(@Body() data: { name: string; color: string }) {
    return this.settingsService.createStaffColor(data);
  }

  @Put("staff-colors/:id")
  @ApiOperation({ summary: "Personel rengini güncelle" })
  async updateStaffColor(@Param("id") id: string, @Body() updates: any) {
    return this.settingsService.updateStaffColor(id, updates);
  }

  @Delete("staff-colors/:id")
  @ApiOperation({ summary: "Personel rengini sil" })
  async deleteStaffColor(@Param("id") id: string) {
    return this.settingsService.deleteStaffColor(id);
  }

  // ============ TABLE TYPES ============

  @Get("table-types")
  @ApiOperation({ summary: "Masa tipi listesini getir" })
  async getTableTypes() {
    return this.settingsService.getTableTypes();
  }

  @Post("table-types")
  @ApiOperation({ summary: "Yeni masa tipi ekle" })
  async createTableType(@Body() data: any) {
    return this.settingsService.createTableType(data);
  }

  @Put("table-types/:id")
  @ApiOperation({ summary: "Masa tipini güncelle" })
  async updateTableType(@Param("id") id: string, @Body() updates: any) {
    return this.settingsService.updateTableType(id, updates);
  }

  @Delete("table-types/:id")
  @ApiOperation({ summary: "Masa tipini sil" })
  async deleteTableType(@Param("id") id: string) {
    return this.settingsService.deleteTableType(id);
  }

  // ============ SMTP / MAIL ============

  @Post("smtp/test")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "SMTP bağlantısını test et (Sadece Admin)" })
  async testSmtpConnection() {
    return this.mailService.testConnection();
  }

  @Post("smtp/test-email")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Test e-postası gönder (Sadece Admin)" })
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
