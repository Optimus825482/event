import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "../../entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  // Tüm kullanıcıları getir
  async findAll(): Promise<Partial<User>[]> {
    const users = await this.userRepository.find({
      order: { createdAt: "DESC" },
    });

    // Şifreleri çıkar
    return users.map(({ password, ...user }) => user);
  }

  // Tek kullanıcı getir
  async findOne(id: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı");
    }
    const { password, ...result } = user;
    return result;
  }

  // Yeni kullanıcı oluştur
  async create(dto: {
    username: string;
    email?: string;
    password: string;
    fullName: string;
    role?: UserRole;
    phone?: string;
    position?: string;
  }): Promise<Partial<User>> {
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

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      role: dto.role || UserRole.STAFF,
    });

    const saved = await this.userRepository.save(user);
    const { password, ...result } = saved;
    return result;
  }

  // Kullanıcı güncelle
  async update(
    id: string,
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
  ): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı");
    }

    // Username değişiyorsa kontrol et
    if (dto.username && dto.username !== user.username) {
      const existing = await this.userRepository.findOne({
        where: { username: dto.username },
      });
      if (existing) {
        throw new ConflictException("Bu kullanıcı adı zaten kullanılıyor");
      }
    }

    // Email değişiyorsa kontrol et
    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException("Bu email adresi zaten kullanılıyor");
      }
    }

    Object.assign(user, dto);
    const saved = await this.userRepository.save(user);
    const { password, ...result } = saved;
    return result;
  }

  // Şifre değiştir
  async changePassword(
    id: string,
    dto: { currentPassword?: string; newPassword: string }
  ): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı");
    }

    // Mevcut şifre kontrolü (admin değilse)
    if (dto.currentPassword) {
      const isValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isValid) {
        throw new BadRequestException("Mevcut şifre yanlış");
      }
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.save(user);
    return { success: true };
  }

  // Kullanıcı sil
  async delete(id: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı");
    }

    // Admin kendini silemez
    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException("Son admin kullanıcısı silinemez");
      }
    }

    await this.userRepository.remove(user);
    return { success: true };
  }

  // Kullanıcı durumunu değiştir
  async toggleStatus(id: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı");
    }

    user.isActive = !user.isActive;
    const saved = await this.userRepository.save(user);
    const { password, ...result } = saved;
    return result;
  }

  // İstatistikler
  async getStats(): Promise<{
    total: number;
    active: number;
    byRole: Record<string, number>;
  }> {
    const users = await this.userRepository.find();
    const active = users.filter((u) => u.isActive).length;
    const byRole: Record<string, number> = {};

    users.forEach((u) => {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
    });

    return { total: users.length, active, byRole };
  }

  // Username olmayan kullanıcılara username ata (migration)
  async migrateUsernames(): Promise<{ migrated: number; skipped: number }> {
    const users = await this.userRepository.find();
    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      if (user.username) {
        skipped++;
        continue;
      }

      // Email'den veya fullName'den username oluştur
      let baseUsername = "";
      if (user.email) {
        baseUsername = user.email.split("@")[0];
      } else if (user.fullName) {
        baseUsername = user.fullName
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "");
      } else {
        baseUsername = `user_${user.id.substring(0, 8)}`;
      }

      // Benzersiz username oluştur
      let username = baseUsername;
      let counter = 1;
      while (await this.userRepository.findOne({ where: { username } })) {
        username = `${baseUsername}_${counter}`;
        counter++;
      }

      user.username = username;
      await this.userRepository.save(user);
      migrated++;
    }

    return { migrated, skipped };
  }
}
