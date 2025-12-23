import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Reservation } from "./reservation.entity";

@Entity("customers")
@Index("IDX_customer_phone", ["phone"]) // Performans: Telefon ile arama
@Index("IDX_customer_email", ["email"]) // Performans: Email ile arama
@Index("IDX_customer_vipScore", ["vipScore"]) // Performans: VIP sıralama
export class Customer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index("IDX_customer_fullName") // Performans: İsim ile arama
  @Column()
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 0 })
  vipScore: number;

  @Column({ type: "text", array: true, default: "{}" })
  tags: string[];

  @Column({ default: false })
  isBlacklisted: boolean;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: 0 })
  totalSpent: number;

  @Column({ default: 0 })
  eventCount: number;

  // Son katıldığı etkinlik tarihi
  @Column({ type: "timestamp", nullable: true })
  lastEventDate: Date;

  // Son katıldığı etkinlik ID
  @Column({ nullable: true })
  lastEventId: string;

  // Toplam katıldığı etkinlik sayısı (check-in yapılan)
  @Column({ default: 0 })
  totalAttendedEvents: number;

  // Toplam rezervasyon sayısı (iptal dahil)
  @Column({ default: 0 })
  totalReservations: number;

  // No-show sayısı
  @Column({ default: 0 })
  noShowCount: number;

  @OneToMany(() => Reservation, (reservation) => reservation.customer)
  reservations: Reservation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
