import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum ModulePermission {
  EVENTS = "events",
  RESERVATIONS = "reservations",
  CHECK_IN = "check_in",
  STAFF = "staff",
  CUSTOMERS = "customers",
  VENUES = "venues",
  SETTINGS = "settings",
  USERS = "users",
  INVITATIONS = "invitations",
  NOTIFICATIONS = "notifications",
}

@Entity("user_permissions")
export class UserPermission {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "enum",
    enum: ModulePermission,
  })
  module: ModulePermission;

  @Column({ default: true })
  canView: boolean;

  @Column({ default: false })
  canCreate: boolean;

  @Column({ default: false })
  canEdit: boolean;

  @Column({ default: false })
  canDelete: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
