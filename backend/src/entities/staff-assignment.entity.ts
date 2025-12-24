import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Event } from "./event.entity";
import { User } from "./user.entity";

@Entity("staff_assignments")
@Index("IDX_staff_assignment_event", ["eventId"]) // Performans: Event bazlı sorgular
@Index("IDX_staff_assignment_staff", ["staffId"]) // Performans: Staff bazlı sorgular
@Index("IDX_staff_assignment_event_staff", ["eventId", "staffId"]) // Performans: Unique lookup
export class StaffAssignment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Event, (event) => event.staffAssignments)
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => User, (user) => user.staffAssignments)
  @JoinColumn({ name: "staffId" })
  staff: User;

  @Column()
  staffId: string;

  @Column({ type: "text", array: true, default: "{}" })
  assignedTableIds: string[];

  @Column({ nullable: true })
  color: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity("staff_performance_logs")
export class StaffPerformanceLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  staffId: string;

  @Column()
  eventId: string;

  @Column()
  actionType: string;

  @Column({ nullable: true })
  responseTimeSeconds: number;

  @Column({ type: "jsonb", nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;
}
