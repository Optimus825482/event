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
import { ServicePoint } from "./service-point.entity";
import { Staff } from "./staff.entity";
import { WorkShift } from "./work-shift.entity";

/**
 * Hizmet Noktası Personel Ataması Entity
 * Hizmet noktalarına atanan personel bilgileri
 */
@Entity("service_point_staff_assignments")
@Index("IDX_sp_staff_assignment_event", ["eventId"])
@Index("IDX_sp_staff_assignment_service_point", ["servicePointId"])
@Index("IDX_sp_staff_assignment_staff", ["staffId"])
@Index("IDX_sp_staff_assignment_event_active", ["eventId", "isActive"])
export class ServicePointStaffAssignment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Etkinlik ilişkisi
  @ManyToOne(() => Event, (event) => event.servicePointStaffAssignments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column()
  eventId: string;

  // Hizmet noktası ilişkisi
  @ManyToOne(() => ServicePoint, (sp) => sp.staffAssignments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "servicePointId" })
  servicePoint: ServicePoint;

  @Column()
  servicePointId: string;

  // Personel ilişkisi
  @ManyToOne(() => Staff, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "staffId" })
  staff: Staff;

  @Column()
  staffId: string;

  // Atanan görev/rol
  @Column()
  role: string; // barman, hostes, garson, barboy, security, vb.

  // Vardiya bilgisi
  @ManyToOne(() => WorkShift, { nullable: true })
  @JoinColumn({ name: "shiftId" })
  shift: WorkShift;

  @Column({ nullable: true })
  shiftId: string;

  // Manuel vardiya saatleri (shift yoksa)
  @Column({ nullable: true })
  shiftStart: string; // "18:00"

  @Column({ nullable: true })
  shiftEnd: string; // "02:00"

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
