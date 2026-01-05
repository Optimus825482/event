import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { InvitationTemplate } from "./invitation-template.entity";

@Entity("event_invitations")
export class EventInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  eventId: string;

  @Column({ type: "uuid", nullable: true })
  templateId: string | null;

  @ManyToOne(() => InvitationTemplate, { nullable: true })
  @JoinColumn({ name: "templateId" })
  template: InvitationTemplate;

  @Column({ type: "jsonb", nullable: true })
  customElements: Record<string, any> | null;

  @Column({ type: "varchar", length: 10, default: "A5" })
  size: string;

  @Column({ type: "int", default: 559 })
  width: number;

  @Column({ type: "int", default: 794 })
  height: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  backgroundColor: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  backgroundImage: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  backgroundGradient: string | null;

  @Column({ type: "jsonb", default: [] })
  eventImages: string[];

  @Column({ type: "varchar", length: 500, nullable: true })
  companyLogo: string | null;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
