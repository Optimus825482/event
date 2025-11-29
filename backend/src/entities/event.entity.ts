import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { VenueTemplate } from './venue-template.entity';
import { Reservation } from './reservation.entity';
import { StaffAssignment } from './staff-assignment.entity';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'timestamp' })
  eventDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  eventEndDate: Date | null;

  @Column({ type: 'jsonb', nullable: true })
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

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @Column({ nullable: true })
  coverImage: string;

  @Column({ default: 0 })
  totalCapacity: number;

  @ManyToOne(() => User, user => user.events, { nullable: true })
  @JoinColumn({ name: 'organizerId' })
  organizer: User;

  @Column({ nullable: true })
  organizerId: string;

  @ManyToOne(() => VenueTemplate, { nullable: true })
  @JoinColumn({ name: 'venueTemplateId' })
  venueTemplate: VenueTemplate;

  @Column({ nullable: true })
  venueTemplateId: string;

  @OneToMany(() => Reservation, reservation => reservation.event)
  reservations: Reservation[];

  @OneToMany(() => StaffAssignment, assignment => assignment.event)
  staffAssignments: StaffAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
