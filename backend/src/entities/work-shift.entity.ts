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
import { Event } from "./event.entity";

@Entity("work_shifts")
@Index("IDX_work_shift_event", ["eventId"])
export class WorkShift {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "time" })
  startTime: string;

  @Column({ type: "time" })
  endTime: string;

  @Column({ default: "#3b82f6" })
  color: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  // Etkinliğe özel vardiya - null ise global vardiya
  @ManyToOne(() => Event, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event: Event | null;

  @Column({ type: "uuid", nullable: true })
  eventId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
