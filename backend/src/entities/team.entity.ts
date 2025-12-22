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

@Entity("teams")
export class Team {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ default: "#3b82f6" })
  color: string;

  // Ekip üyeleri (User ID'leri)
  @Column({ type: "text", array: true, default: "{}" })
  memberIds: string[];

  // Ekip Lideri
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "leaderId" })
  leader: User;

  @Column({ nullable: true })
  leaderId: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
