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

// Ekip üyesi yapısı
export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  color: string;
  position?: string;
  avatar?: string;
}

@Entity("service_teams")
@Index("IDX_service_team_event", ["eventId"]) // Performans: Event bazlı sorgular
// GIN indeksler (tableIds, members) migration'da oluşturulur - TypeORM dekoratörü desteklemez
export class ServiceTeam {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Event, (event) => event.serviceTeams, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column({ nullable: true })
  eventId: string;

  @Column()
  name: string;

  @Column({ default: "#3b82f6" })
  color: string;

  // Ekip üyeleri (JSON olarak saklanıyor)
  @Column({ type: "jsonb", default: "[]" })
  members: TeamMember[];

  // Şef/Lider ID'si
  @Column({ nullable: true })
  leaderId?: string;

  // Atanmış masa ID'leri
  @Column({ type: "text", array: true, default: "{}" })
  tableIds: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
