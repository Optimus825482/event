import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserRole } from "../../entities/user.entity";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Tüm kullanıcıları getir
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // İstatistikler
  @Get("stats")
  getStats() {
    return this.usersService.getStats();
  }

  // Username olmayan kullanıcılara username ata (migration)
  @Post("migrate-usernames")
  migrateUsernames() {
    return this.usersService.migrateUsernames();
  }

  // Tek kullanıcı getir
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  // Yeni kullanıcı oluştur
  @Post()
  create(
    @Body()
    dto: {
      username: string;
      email?: string;
      password: string;
      fullName: string;
      role?: UserRole;
      phone?: string;
      position?: string;
    }
  ) {
    return this.usersService.create(dto);
  }

  // Kullanıcı güncelle
  @Put(":id")
  update(
    @Param("id") id: string,
    @Body()
    dto: {
      username?: string;
      email?: string;
      fullName?: string;
      role?: UserRole;
      phone?: string;
      position?: string;
      isActive?: boolean;
      color?: string;
    }
  ) {
    return this.usersService.update(id, dto);
  }

  // Şifre değiştir
  @Patch(":id/password")
  changePassword(
    @Param("id") id: string,
    @Body() dto: { currentPassword?: string; newPassword: string }
  ) {
    return this.usersService.changePassword(id, dto);
  }

  // Kullanıcı durumunu değiştir
  @Patch(":id/toggle-status")
  toggleStatus(@Param("id") id: string) {
    return this.usersService.toggleStatus(id);
  }

  // Kullanıcı sil
  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.usersService.delete(id);
  }
}
