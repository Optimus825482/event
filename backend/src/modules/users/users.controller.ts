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
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";
import {
  CreateUserDto,
  UpdateUserDto,
  AdminChangePasswordDto,
} from "./dto/users.dto";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
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

  // Tek kullanıcı getir
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  // Yeni kullanıcı oluştur
  @Post()
  @ApiOperation({ summary: "Yeni kullanıcı oluştur" })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // Kullanıcı güncelle
  @Put(":id")
  @ApiOperation({ summary: "Kullanıcı güncelle" })
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // Şifre değiştir
  @Patch(":id/password")
  @ApiOperation({ summary: "Şifre değiştir" })
  changePassword(@Param("id") id: string, @Body() dto: AdminChangePasswordDto) {
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
