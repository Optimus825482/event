import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Event } from "./event.entity";
import { WorkShift } from "./work-shift.entity";
import { Team } from "./team.entity";

@Entity("event_staff_assignments")
@Index("IDX_event_staff_assignment_event", ["eventId"]) // Performans: Event bazlı sorgular
@Index("IDX_event_staff_assignment_staff", ["staffId"]) // Performans: Staff bazlı sorgular
@Index("IDX_event_staff_assignment_event_active", ["eventId", "isActive"]) // Performans: Aktif atamalar
@Index("IDX_event_staff_assignment_staff_active", ["staffId", "isActive"]) // Performans: Staff aktif atamaları
export class EventStaffAssignment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Etkinlik
  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column()
  eventId: string;

  // Personel
  @ManyToOne(() => User)
  @JoinColumn({ name: "staffId" })
  staff: User;

  @Column()
  staffId: string;

  // Atanan masalar (ID array)
  @Column({ type: "text", array: true, default: "{}" })
  tableIds: string[];

  // Çalışma saati/vardiya
  @ManyToOne(() => WorkShift, { nullable: true })
  @JoinColumn({ name: "shiftId" })
  shift: WorkShift;

  @Column({ nullable: true })
  shiftId: string;

  // Atanan ekip (opsiyonel)
  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: "teamId" })
  team: Team;

  @Column({ nullable: true })
  teamId: string;

  // Personel rengi (override)
  @Column({ nullable: true })
  color: string;

  // Atama tipi: table (masa ataması) veya special_task (özel görev)
  @Column({ default: "table" })
  assignmentType: string;

  // Özel görev alanları
  @Column({ nullable: true })
  specialTaskLocation: string;

  @Column({ nullable: true })
  specialTaskStartTime: string;

  @Column({ nullable: true })
  specialTaskEndTime: string;

  // Notlar
  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
