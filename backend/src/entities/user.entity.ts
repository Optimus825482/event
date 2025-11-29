import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Event } from './event.entity';
import { StaffAssignment } from './staff-assignment.entity';

export enum UserRole {
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
  STAFF = 'staff',
  VENUE_OWNER = 'venue_owner'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ORGANIZER })
  role: UserRole;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  color: string; // Staff color for table assignments

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Event, event => event.organizer)
  events: Event[];

  @OneToMany(() => StaffAssignment, assignment => assignment.staff)
  staffAssignments: StaffAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
