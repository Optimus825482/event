import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("staff_performance_logs")
export class StaffPerformanceLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  staffId: string;

  @Column({ type: "varchar", length: 255 })
  eventId: string;

  @Column({ type: "varchar", length: 100 })
  actionType: string;

  @Column({ type: "int", nullable: true })
  responseTimeSeconds: number | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
