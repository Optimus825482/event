import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual, Between } from "typeorm";
import { User, UserRole } from "../../entities/user.entity";
import { Event } from "../../entities/event.entity";
import { Team } from "../../entities/team.entity";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>
  ) {}

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Kullanıcı istatistikleri
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { isActive: true } });
    const adminCount = await this.userRepository.count({ where: { role: UserRole.ADMIN } });
    const leaderCount = await this.userRepository.count({ where: { role: UserRole.LEADER } });
    const staffCount = await this.userRepository.count({ where: { role: UserRole.STAFF } });
    
    const newUsersThisMonth = await this.userRepository.count({
      where: { createdAt: MoreThanOrEqual(startOfMonth) },
    });

    // Etkinlik istatistikleri
    const totalEvents = await this.eventRepository.count();
    const eventsThisMonth = await this.eventRepository.count({
      where: { createdAt: MoreThanOrEqual(startOfMonth) },
    });
    const eventsToday = await this.eventRepository.count({
      where: { createdAt: MoreThanOrEqual(startOfDay) },
    });
    const upcomingEvents = await this.eventRepository.count({
      where: { eventDate: MoreThanOrEqual(now) },
    });

    // Takım istatistikleri
    const totalTeams = await this.teamRepository.count();
    const activeTeams = await this.teamRepository.count({ where: { isActive: true } });

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminCount,
        leaders: leaderCount,
        staff: staffCount,
        newThisMonth: newUsersThisMonth,
      },
      events: {
        total: totalEvents,
        thisMonth: eventsThisMonth,
        today: eventsToday,
        upcoming: upcomingEvents,
      },
      teams: {
        total: totalTeams,
        active: activeTeams,
      },
      system: {
        uptime: "99.9%",
        version: "1.0.0",
        lastBackup: new Date().toISOString(),
      },
    };
  }
}
