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
import { Customer } from "./customer.entity";
import { Event } from "./event.entity";
import { Reservation } from "./reservation.entity";

// Not tipi - etkinlik öncesi, sırası, sonrası
export enum GuestNoteType {
  PRE_EVENT = "pre_event", // Etkinlik öncesi
  DURING_EVENT = "during_event", // Etkinlik sırası
  POST_EVENT = "post_event", // Etkinlik sonrası
  GENERAL = "general", // Genel not
}

@Entity("guest_notes")
@Index("IDX_guest_note_customer", ["customerId"])
@Index("IDX_guest_note_event", ["eventId"])
@Index("IDX_guest_note_customer_event", ["customerId", "eventId"])
// Descending indeks migration'da: IDX_guest_note_created_desc (createdAt DESC)
export class GuestNote {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Customer, { onDelete: "CASCADE" })
  @JoinColumn({ name: "customerId" })
  customer: Customer;

  @Column()
  customerId: string;

  @ManyToOne(() => Event, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column({ nullable: true })
  eventId: string;

  @ManyToOne(() => Reservation, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "reservationId" })
  reservation: Reservation;

  @Column({ nullable: true })
  reservationId: string;

  @Column({ type: "text" })
  content: string;

  @Column({
    type: "enum",
    enum: GuestNoteType,
    default: GuestNoteType.GENERAL,
  })
  noteType: GuestNoteType;

  @Column({ nullable: true })
  createdBy: string; // Notu oluşturan kullanıcı ID

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
