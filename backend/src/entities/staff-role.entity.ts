import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("staff_roles")
export class StaffRole {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  label: string;

  @Column({ default: "#3b82f6" })
  color: string;

  @Column({ default: "bg-blue-500/20 text-blue-400 border-blue-500/30" })
  badgeColor: string;

  @Column({ default: "bg-blue-500" })
  bgColor: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
