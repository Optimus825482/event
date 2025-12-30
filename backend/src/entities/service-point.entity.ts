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

/**
 * Hizmet Noktası Entity
 * Etkinlik alanı dışındaki bar, karşılama, VIP lounge gibi hizmet noktaları
 * Masa planından bağımsız, etkinliğe özel personel atama noktaları
 */
@Entity("service_points")
@Index("IDX_service_point_event", ["eventId"])
@Index("IDX_service_point_event_active", ["eventId", "isActive"])
export class ServicePoint {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Etkinlik ilişkisi
  @ManyToOne(() => Event, (event) => event.servicePoints, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column()
  eventId: string;

  // Hizmet noktası adı (örn: "Ana Bar", "VIP Lounge", "Karşılama")
  @Column()
  name: string;

  // Nokta tipi
  @Column({ default: "bar" })
  pointType: string; // bar, lounge, reception, vip_area, backstage, other

  // Gerekli personel sayısı
  @Column({ default: 1 })
  requiredStaffCount: number;

  // Atanabilecek görevler (JSON array)
  @Column({ type: "text", array: true, default: "{}" })
  allowedRoles: string[]; // barman, hostes, garson, barboy, security, vb.

  // Konum bilgisi (canvas'ta gösterim için)
  @Column({ type: "float", default: 0 })
  x: number;

  @Column({ type: "float", default: 0 })
  y: number;

  // Görsel özellikler
  @Column({ default: "#06b6d4" }) // Cyan renk varsayılan
  color: string;

  @Column({ default: "square" }) // square, circle, rectangle
  shape: string;

  // Açıklama/Notlar
  @Column({ type: "text", nullable: true })
  description: string;

  // Sıralama
  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
