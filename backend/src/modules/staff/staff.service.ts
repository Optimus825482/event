import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffAssignment, User } from '../../entities';
import { UserRole } from '../../entities/user.entity';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffAssignment)
    private assignmentRepository: Repository<StaffAssignment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Personel listesi (role = 'staff')
  async findAllStaff(): Promise<User[]> {
    return this.userRepository.find({
      where: { role: UserRole.STAFF },
      select: ['id', 'fullName', 'email', 'color'],
    });
  }

  // Etkinlik için masa ataması yap
  async assignTables(eventId: string, staffId: string, tableIds: string[]): Promise<StaffAssignment> {
    let assignment = await this.assignmentRepository.findOne({
      where: { eventId, staffId },
    });

    if (assignment) {
      assignment.assignedTableIds = tableIds;
      return this.assignmentRepository.save(assignment);
    }

    assignment = this.assignmentRepository.create({
      eventId,
      staffId,
      assignedTableIds: tableIds,
    });
    return this.assignmentRepository.save(assignment);
  }

  // Etkinlik için tüm atamaları getir
  async getEventAssignments(eventId: string): Promise<StaffAssignment[]> {
    return this.assignmentRepository.find({
      where: { eventId },
      relations: ['staff'],
    });
  }

  // Personelin baktığı masaları getir
  async getStaffTables(eventId: string, staffId: string): Promise<string[]> {
    const assignment = await this.assignmentRepository.findOne({
      where: { eventId, staffId },
    });
    return assignment?.assignedTableIds || [];
  }

  // Performans kaydı
  async logPerformance(staffId: string, eventId: string, actionType: string, responseTime: number) {
    // Performans log tablosu eklenebilir
  }
}
