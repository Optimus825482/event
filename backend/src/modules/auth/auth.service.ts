import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "../../entities/user.entity";
import { RegisterDto, LoginDto } from "./dto/auth.dto";

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService
  ) {}

  // Uygulama başladığında varsayılan admin kullanıcısını oluştur
  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  private async ensureDefaultAdmin() {
    try {
      const adminExists = await this.userRepository.findOne({
        where: { username: "admin" },
      });

      if (!adminExists) {
        const hashedPassword = await bcrypt.hash("Admin123!", 10);
        const admin = this.userRepository.create({
          username: "admin",
          email: "admin@eventflow.com",
          password: hashedPassword,
          fullName: "System Admin",
          role: UserRole.ADMIN,
          isActive: true,
        });
        await this.userRepository.save(admin);
        console.log("✅ Varsayılan admin kullanıcısı oluşturuldu: admin");
      }
    } catch (error) {
      console.error("Admin kullanıcısı oluşturulurken hata:", error.message);
    }
  }

  async register(dto: RegisterDto) {
    // Username kontrolü
    const existingUsername = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException("Bu kullanıcı adı zaten kayıtlı");
    }

    // Email kontrolü (opsiyonel)
    if (dto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException("Bu email adresi zaten kayıtlı");
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });

    await this.userRepository.save(user);
    const { password, ...result } = user;
    return { user: result, token: this.generateToken(user) };
  }

  async login(dto: LoginDto) {
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
    return { user: result, token: this.generateToken(user) };
  }

  async validateUser(userId: string) {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  private generateToken(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return this.jwtService.sign(payload);
  }
}
