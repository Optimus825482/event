import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Throttle, SkipThrottle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, ChangePasswordDto } from "./dto/auth.dto";
import { RefreshTokenDto, TokenResponseDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 kayıt/dakika
  @ApiOperation({ summary: "Yeni kullanıcı kaydı" })
  @ApiResponse({ status: 201, description: "Kayıt başarılı" })
  @ApiResponse({
    status: 409,
    description: "Kullanıcı adı veya email zaten kayıtlı",
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 giriş denemesi/dakika
  @ApiOperation({ summary: "Kullanıcı girişi" })
  @ApiResponse({ status: 200, description: "Giriş başarılı" })
  @ApiResponse({ status: 401, description: "Geçersiz kimlik bilgileri" })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refresh/dakika
  @ApiOperation({ summary: "Access token yenileme" })
  @ApiResponse({
    status: 200,
    description: "Token yenilendi",
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 401, description: "Geçersiz refresh token" })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Şifre değiştirme" })
  @ApiResponse({ status: 200, description: "Şifre değiştirildi" })
  @ApiResponse({ status: 400, description: "Mevcut şifre yanlış" })
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mevcut kullanıcı bilgisi" })
  @ApiResponse({ status: 200, description: "Kullanıcı bilgisi" })
  async getProfile(@Request() req) {
    return req.user;
  }
}
