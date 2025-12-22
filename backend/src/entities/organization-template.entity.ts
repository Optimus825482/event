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

// Şablon içindeki personel ataması
interface TemplateStaffAssignment {
  staffId: string;
  tableIds: string[];
  shiftId?: string;
  teamId?: string;
  color?: string;
}

// Şablon içindeki ekip ataması
interface TemplateTeamAssignment {
  teamId: string;
  staffIds: string[];
  tableIds: string[];
  color?: string;
}

@Entity("organization_templates")
export class OrganizationTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  // Şablonu oluşturan kullanıcı
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "createdById" })
  createdBy: User;

  @Column({ nullable: true })
  createdById: string;

  // Personel atamaları (JSON)
  @Column({ type: "jsonb", default: [] })
  staffAssignments: TemplateStaffAssignment[];

  // Ekip atamaları (JSON)
  @Column({ type: "jsonb", default: [] })
  teamAssignments: TemplateTeamAssignment[];

  // Masa grupları (JSON)
  @Column({ type: "jsonb", default: [] })
  tableGroups: any[];

  // Şablon ayarları
  @Column({ type: "jsonb", default: {} })
  settings: {
    autoAssignShifts?: boolean;
    defaultShiftId?: string;
    preserveColors?: boolean;
  };

  // Etiketler
  @Column({ type: "text", array: true, default: "{}" })
  tags: string[];

  // Varsayılan şablon mu?
  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
