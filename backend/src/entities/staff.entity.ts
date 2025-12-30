import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum Gender {
  MALE = "male",
  FEMALE = "female",
}

export enum StaffStatus {
  ACTIVE = "active", // Çalışıyor
  INACTIVE = "inactive", // Pasif
  TERMINATED = "terminated", // Ayrıldı
}

@Entity("staff")
@Index("IDX_staff_sicil", ["sicilNo"], { unique: true })
@Index("IDX_staff_department", ["department"])
@Index("IDX_staff_work_location", ["workLocation"])
@Index("IDX_staff_position", ["position"])
@Index("IDX_staff_status", ["status"])
@Index("IDX_staff_is_active", ["isActive"])
export class Staff {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // ==================== KİMLİK BİLGİLERİ ====================

  // Sicil numarası (HR sisteminden gelen unique ID)
  @Column({ unique: true })
  sicilNo: string;

  // Ad Soyad
  @Column()
  fullName: string;

  // Email (opsiyonel)
  @Column({ nullable: true })
  email: string;

  // Telefon
  @Column({ nullable: true })
  phone: string;

  // Profil fotoğrafı
  @Column({ nullable: true })
  avatar: string;

  // ==================== İŞ BİLGİLERİ ====================

  // Unvan/Pozisyon (Waiter, Barman, Supervisor, Captain vs.)
  @Column()
  position: string;

  // Çalıştığı bölüm (Restaurant, Bar, A'la Carte, Room Servis, Banket, Yönetim)
  @Column({ nullable: true })
  department: string;

  // Görev yeri (Diamond Hotel, Royal Hotel)
  @Column({ nullable: true })
  workLocation: string;

  // Miço (mentor/supervisor) ismi
  @Column({ nullable: true })
  mentor: string;

  // Renk (masa atamalarında kullanılır)
  @Column({ nullable: true })
  color: string;

  // ==================== KİŞİSEL BİLGİLER ====================

  // Cinsiyet
  @Column({ type: "enum", enum: Gender, nullable: true })
  gender: Gender;

  // Doğum tarihi
  @Column({ type: "date", nullable: true })
  birthDate: Date;

  // Yaş (hesaplanabilir ama cache için)
  @Column({ type: "int", nullable: true })
  age: number;

  // Kan grubu
  @Column({ nullable: true })
  bloodType: string;

  // ==================== BEDEN BİLGİLERİ ====================

  // Ayakkabı numarası
  @Column({ type: "int", nullable: true })
  shoeSize: number;

  // Çorap bedeni (S, M, L, XL, XXL)
  @Column({ nullable: true })
  sockSize: string;

  // ==================== İŞE GİRİŞ/ÇIKIŞ BİLGİLERİ ====================

  // İşe giriş tarihi
  @Column({ type: "date", nullable: true })
  hireDate: Date;

  // Ayrılma tarihi
  @Column({ type: "date", nullable: true })
  terminationDate: Date;

  // Ayrılma nedeni
  @Column({ nullable: true })
  terminationReason: string;

  // Şirkette geçirdiği yıl
  @Column({ type: "int", nullable: true })
  yearsAtCompany: number;

  // ==================== DURUM ====================

  // Aktif mi?
  @Column({ default: true })
  isActive: boolean;

  // Durum (Çalışıyor, Pasif, Ayrıldı)
  @Column({ type: "enum", enum: StaffStatus, default: StaffStatus.ACTIVE })
  status: StaffStatus;

  // ==================== TIMESTAMPS ====================

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
