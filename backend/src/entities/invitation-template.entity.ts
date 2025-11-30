import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

// Davetiye elementi tipi
export interface InvitationElement {
  id: string;
  type:
    | "text"
    | "image"
    | "qrcode"
    | "guestName"
    | "eventName"
    | "eventDate"
    | "eventTime"
    | "eventLocation"
    | "eventDescription"
    | "logo";
  x: number; // Pozisyon X (px)
  y: number; // Pozisyon Y (px)
  width: number;
  height: number;
  rotation?: number;
  // Text özellikleri
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  // Image özellikleri
  imageUrl?: string;
  objectFit?: "contain" | "cover" | "fill";
  borderRadius?: number;
  // Genel stiller
  backgroundColor?: string;
  border?: string;
  opacity?: number;
  zIndex?: number;
}

// Davetiye boyut presetleri
export type InvitationSize = "A5" | "A6" | "SQUARE" | "CUSTOM";

// Davetiye boyutları (px - 96 DPI)
export const INVITATION_SIZES = {
  A5: { width: 559, height: 794 }, // 148mm x 210mm
  A6: { width: 397, height: 559 }, // 105mm x 148mm
  SQUARE: { width: 600, height: 600 },
  CUSTOM: { width: 600, height: 800 },
};

@Entity("invitation_templates")
export class InvitationTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isDefault: boolean; // Varsayılan şablon mu?

  @Column({ default: false })
  isSystemTemplate: boolean; // Sistem şablonu mu (silinemez)?

  @Column({ type: "varchar", default: "A5" })
  size: InvitationSize;

  @Column({ default: 559 })
  width: number;

  @Column({ default: 794 })
  height: number;

  @Column({ nullable: true })
  backgroundColor: string;

  @Column({ nullable: true })
  backgroundImage: string;

  @Column({ nullable: true })
  backgroundGradient: string;

  // Davetiye elementleri (JSON)
  @Column({ type: "jsonb", default: [] })
  elements: InvitationElement[];

  // Şablonu oluşturan kullanıcı
  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "createdById" })
  createdBy: User;

  // Önizleme görseli (thumbnail)
  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Etkinliğe özel davetiye ayarları
@Entity("event_invitations")
export class EventInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  eventId: string;

  // Kullanılan şablon (null ise özel tasarım)
  @Column({ nullable: true })
  templateId: string;

  @ManyToOne(() => InvitationTemplate, { nullable: true })
  @JoinColumn({ name: "templateId" })
  template: InvitationTemplate;

  // Özelleştirilmiş elementler (şablondan farklıysa)
  @Column({ type: "jsonb", nullable: true })
  customElements: InvitationElement[];

  // Boyut
  @Column({ type: "varchar", default: "A5" })
  size: InvitationSize;

  @Column({ default: 559 })
  width: number;

  @Column({ default: 794 })
  height: number;

  @Column({ nullable: true })
  backgroundColor: string;

  @Column({ nullable: true })
  backgroundImage: string;

  @Column({ nullable: true })
  backgroundGradient: string;

  // Etkinliğe özel yüklenen görseller
  @Column({ type: "jsonb", default: [] })
  eventImages: string[];

  // Firma logosu
  @Column({ nullable: true })
  companyLogo: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
