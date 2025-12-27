import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("system_settings")
export class SystemSettings {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: "Test Firması" })
  companyName: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ default: "Europe/Nicosia" })
  timezone: string;

  @Column({ default: "tr" })
  language: string;

  // Canvas Ayarları
  @Column({ default: 20 })
  defaultGridSize: number;

  @Column({ default: true })
  snapToGrid: boolean;

  @Column({ default: true })
  showGridByDefault: boolean;

  // Rezervasyon Ayarları
  @Column({ default: 2 })
  defaultGuestCount: number;

  @Column({ default: false })
  allowOverbooking: boolean;

  @Column({ default: true })
  requirePhoneNumber: boolean;

  @Column({ default: false })
  requireEmail: boolean;

  // Check-in Ayarları
  @Column({ default: false })
  autoCheckInEnabled: boolean;

  @Column({ default: true })
  checkInSoundEnabled: boolean;

  @Column({ default: true })
  showTableDirections: boolean;

  // Bildirim Ayarları
  @Column({ default: true })
  emailNotifications: boolean;

  @Column({ default: false })
  smsNotifications: boolean;

  // SMTP Ayarları
  @Column({ nullable: true })
  smtpHost: string;

  @Column({ default: 587 })
  smtpPort: number;

  @Column({ nullable: true })
  smtpUser: string;

  @Column({ nullable: true })
  smtpPassword: string;

  @Column({ nullable: true })
  smtpFromEmail: string;

  @Column({ nullable: true })
  smtpFromName: string;

  @Column({ default: false })
  smtpSecure: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity("staff_colors")
export class StaffColor {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  color: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
