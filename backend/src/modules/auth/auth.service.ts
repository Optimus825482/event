import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  OnModuleInit,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "../../entities/user.entity";
import { RegisterDto, LoginDto, ChangePasswordDto } from "./dto/auth.dto";
import { TokenResponseDto } from "./dto/refresh-token.dto";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    // Refresh secret: önce JWT_REFRESH_SECRET, yoksa JWT_SECRET kullan
    const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET");
    const jwtSecret = this.configService.get<string>("JWT_SECRET");
    this.refreshSecret = refreshSecret || jwtSecret || "";

    this.refreshExpiresIn =
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") || "7d";
  }

  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  private async ensureDefaultAdmin() {
    try {
      const adminExists = await this.userRepository.findOne({
        where: { username: "admin" },
      });

      if (!adminExists) {
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

        if (!adminPassword || adminPassword.length < 12) {
          console.warn(
            "⚠️ DEFAULT_ADMIN_PASSWORD tanımlı değil veya çok kısa. " +
              "Admin kullanıcısı oluşturulmadı."
          );
          return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        const admin = this.userRepository.create({
          username: "admin",
          email: "admin@eventflow.com",
          password: hashedPassword,
          fullName: "System Admin",
          role: UserRole.ADMIN,
          isActive: true,
        });
        await this.userRepository.save(admin);
        console.log("✅ Admin kullanıcısı oluşturuldu");
      }
    } catch (error) {
      console.error("Admin oluşturma hatası:", error.message);
    }
  }

  async register(
    dto: RegisterDto
  ): Promise<{ user: Partial<User>; tokens: TokenResponseDto }> {
    const existingUsername = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException("Bu kullanıcı adı zaten kayıtlı");
    }

    if (dto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException("Bu email adresi zaten kayıtlı");
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });

    await this.userRepository.save(user);
    const { password, ...result } = user;
    return { user: result, tokens: this.generateTokens(user) };
  }

  async login(
    dto: LoginDto
  ): Promise<{ user: Partial<User>; tokens: TokenResponseDto }> {
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (!user) {
      throw new UnauthorizedException("Geçersiz kullanıcı adı veya şifre");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Hesabınız pasif durumda");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Geçersiz kullanıcı adı veya şifre");
    }

    const { password, ...result } = user;
    return { user: result, tokens: this.generateTokens(user) };
  }

  async refreshTokens(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshSecret,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException("Geçersiz refresh token");
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException(
        "Geçersiz veya süresi dolmuş refresh token"
      );
    }
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("Kullanıcı bulunamadı");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException("Mevcut şifre yanlış");
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException("Yeni şifre mevcut şifreden farklı olmalı");
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);

    return { success: true, message: "Şifre başarıyla değiştirildi" };
  }

  async validateUser(userId: string) {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  private generateTokens(user: User): TokenResponseDto {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as string,
    } as any);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 dakika
    };
  }
}
