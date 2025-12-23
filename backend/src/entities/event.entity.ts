import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { VenueTemplate } from "./venue-template.entity";
import { Reservation } from "./reservation.entity";
import { StaffAssignment } from "./staff-assignment.entity";
import { ServiceTeam } from "./service-team.entity";
import { EventStaffAssignment } from "./event-staff-assignment.entity";

export enum EventStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

@Entity("events")
@Index("IDX_event_organizer_date", ["organizerId", "eventDate"]) // Performans: Organizatör bazlı listeleme
@Index("IDX_event_status_date", ["status", "eventDate"]) // Performans: Status ve tarih filtreleme
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: "timestamp" })
  eventDate: Date;

  @Column({ type: "timestamp", nullable: true })
  eventEndDate: Date | null;

  @Column({ type: "jsonb", nullable: true })
  venueLayout: {
    tables: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      rotation: number;
      capacity: number;
      label: string;
    }>;
    walls: Array<{
      id: string;
      points: number[];
    }>;
    stage: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    dimensions: {
      width: number;
      height: number;
    };
  };

  @Column({ type: "enum", enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @Column({ nullable: true })
  eventType: string;

  @Column({ nullable: true })
  coverImage: string;

  @Column({ default: 0 })
  totalCapacity: number;

  @ManyToOne(() => User, (user) => user.events, { nullable: true })
  @JoinColumn({ name: "organizerId" })
  organizer: User;

  @Column({ nullable: true })
  organizerId: string;

  @ManyToOne(() => VenueTemplate, { nullable: true })
  @JoinColumn({ name: "venueTemplateId" })
  venueTemplate: VenueTemplate;

  @Column({ nullable: true })
  venueTemplateId: string;

  @OneToMany(() => Reservation, (reservation) => reservation.event)
  reservations: Reservation[];

  @OneToMany(() => StaffAssignment, (assignment) => assignment.event)
  staffAssignments: StaffAssignment[];

  @OneToMany(() => ServiceTeam, (team) => team.event)
  serviceTeams: ServiceTeam[];

  @OneToMany(() => EventStaffAssignment, (assignment) => assignment.event)
  eventStaffAssignments: EventStaffAssignment[];

  // Performans değerlendirme sistemi ayarları
  @Column({ type: "boolean", default: false })
  reviewEnabled: boolean; // Liderler değerlendirme yapabilir mi?

  @Column({ type: "boolean", default: false })
  reviewHistoryVisible: boolean; // Liderler geçmiş değerlendirmeleri görebilir mi?

  // Rezervasyon sistemi ayarı
  @Column({ type: "boolean", default: true })
  reservationEnabled: boolean; // Bu etkinlik için rezervasyon alınabilir mi?

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
