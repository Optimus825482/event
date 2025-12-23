import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Event } from "./event.entity";

export enum NotificationType {
  // Etkinlik bildirimleri
  EVENT_CREATED = "event_created",
  EVENT_UPDATED = "event_updated",
  EVENT_CANCELLED = "event_cancelled",
  VENUE_LAYOUT_COMPLETED = "venue_layout_completed",
  TEAM_ORGANIZATION_COMPLETED = "team_organization_completed",

  // Değerlendirme bildirimleri
  REVIEW_SYSTEM_ACTIVATED = "review_system_activated",
  REVIEW_SYSTEM_DEACTIVATED = "review_system_deactivated",
  STAFF_REVIEW_COMPLETED = "staff_review_completed",
  STAFF_REVIEW_UPDATED = "staff_review_updated",

  // Rezervasyon bildirimleri
  RESERVATION_SYSTEM_ACTIVATED = "reservation_system_activated",
  RESERVATION_SYSTEM_DEACTIVATED = "reservation_system_deactivated",

  // Ekip bildirimleri
  TEAM_ASSIGNMENT_CHANGED = "team_assignment_changed",
  STAFF_ADDED_TO_TEAM = "staff_added_to_team",
  STAFF_REMOVED_FROM_TEAM = "staff_removed_from_team",
  TABLE_GROUP_CHANGED = "table_group_changed",

  // Personel bildirimleri
  NEW_STAFF_ADDED = "new_staff_added",

  // Sistem bildirimleri
  SYSTEM_ANNOUNCEMENT = "system_announcement",
}

export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum NotificationTargetRole {
  ALL = "all",
  ADMIN = "admin",
  LEADER = "leader",
  STAFF = "staff",
}

@Entity("notifications")
@Index(["type", "createdAt"])
@Index(["targetRole", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({
    type: "enum",
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Column({
    type: "enum",
    enum: NotificationTargetRole,
    default: NotificationTargetRole.ALL,
  })
  targetRole: NotificationTargetRole;

  // İlişkili etkinlik (opsiyonel)
  @Column({ type: "uuid", nullable: true })
  eventId: string | null;

  @ManyToOne(() => Event, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "eventId" })
  event: Event | null;

  // Bildirimi oluşturan kullanıcı
  @Column({ type: "uuid", nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "createdById" })
  createdBy: User | null;

  // Ek veri (JSON formatında)
  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  // Link (tıklandığında yönlendirilecek sayfa)
  @Column({ type: "varchar", nullable: true })
  actionUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Okunma kayıtları
  @OneToMany(() => NotificationRead, (read) => read.notification)
  reads: NotificationRead[];
}

@Entity("notification_reads")
@Index(["notificationId", "userId"], { unique: true })
@Index(["userId", "readAt"])
export class NotificationRead {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  notificationId: string;

  @ManyToOne(() => Notification, (notification) => notification.reads, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "notificationId" })
  notification: Notification;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @CreateDateColumn()
  readAt: Date;
}
