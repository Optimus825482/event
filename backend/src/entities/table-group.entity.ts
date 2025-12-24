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

@Entity("table_groups")
@Index("IDX_table_group_event", ["eventId"]) // Performans: Event bazlı sorgular
@Index("IDX_table_group_team", ["assignedTeamId"]) // Performans: Team bazlı sorgular
export class TableGroup {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column()
  eventId: string;

  @Column()
  name: string;

  @Column({ default: "#3b82f6" })
  color: string;

  // Gruptaki masa ID'leri
  @Column({ type: "text", array: true, default: "{}" })
  tableIds: string[];

  // Atanan ekip ID'si
  @Column({ nullable: true })
  assignedTeamId?: string;

  // Atanan süpervizör ID'si
  @Column({ nullable: true })
  assignedSupervisorId?: string;

  // Grup tipi (vip, standard, terrace, etc.)
  @Column({ default: "standard" })
  groupType: string;

  // Sıralama
  @Column({ default: 0 })
  sortOrder: number;

  // Notlar
  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
