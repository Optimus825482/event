import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Event } from "./event.entity";

export enum PerformanceRating {
  VERY_BAD = "very_bad",
  BAD = "bad",
  AVERAGE = "average",
  GOOD = "good",
  SUCCESSFUL = "successful",
  EXCELLENT = "excellent",
}

@Entity("staff_performance_reviews")
export class StaffPerformanceReview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Değerlendirilen personel
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "staffId" })
  staff: User;

  @Column()
  staffId: string;

  // Değerlendiren lider
  @ManyToOne(() => User)
  @JoinColumn({ name: "reviewerId" })
  reviewer: User;

  @Column()
  reviewerId: string;

  // Etkinlik
  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column()
  eventId: string;

  // Puan (0-100)
  @Column({ type: "int" })
  score: number;

  // Performans değerlendirmesi
  @Column({ type: "enum", enum: PerformanceRating })
  rating: PerformanceRating;

  // Yorum (opsiyonel)
  @Column({ type: "text", nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
