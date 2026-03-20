import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import {
  InvitationTemplate,
  InvitationElement,
  InvitationSize,
} from "./invitation-template.entity";

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
