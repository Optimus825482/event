import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Event } from "./event.entity";

/**
 * Etkinlik Ekstra Personel Entity
 * Sadece belirli bir etkinlik için geçici olarak eklenen personeller
 * Ana personel veritabanına kaydedilmez
 */
@Entity("event_extra_staff")
export class EventExtraStaff {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "event_id" })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event: Event;

  @Column({ name: "full_name" })
  fullName: string;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true })
  role: string; // Atanan görev (garson, barmen, vb.)

  @Column({ name: "shift_start", nullable: true })
  shiftStart: string; // "18:00"

  @Column({ name: "shift_end", nullable: true })
  shiftEnd: string; // "02:00"

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  notes: string;

  // Atandığı grup/masa bilgisi (JSON olarak)
  @Column({ name: "assigned_groups", type: "jsonb", nullable: true })
  assignedGroups: string[]; // Grup ID'leri

  @Column({ name: "assigned_tables", type: "jsonb", nullable: true })
  assignedTables: string[]; // Masa ID'leri

  @Column({ name: "sort_order", default: 0 })
  sortOrder: number;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
