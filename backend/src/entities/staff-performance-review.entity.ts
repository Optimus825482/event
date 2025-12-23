import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Event } from "./event.entity";

export enum PerformanceRating {
  VERY_BAD = "very_bad",
  BAD = "bad",
  AVERAGE = "average",
  GOOD = "good",
  SUCCESSFUL = "successful",
  EXCELLENT = "excellent",
}

// Kategori bazlı puanlar için interface
export interface CategoryScores {
  communication: number; // İletişim Becerileri (0-5)
  punctuality: number; // Dakiklik ve Güvenilirlik (0-5)
  teamwork: number; // Takım Çalışması (0-5)
  customerService: number; // Müşteri Memnuniyeti (0-5)
  technicalSkills: number; // Teknik Beceriler (0-5)
  initiative: number; // İnisiyatif ve Problem Çözme (0-5)
  appearance: number; // Kıyafet ve Görünüm (0-5)
  stressManagement: number; // Stres Yönetimi (0-5)
}

@Entity("staff_performance_reviews")
@Index(["staffId", "eventId", "reviewerId"], { unique: true })
@Index(["staffId"])
@Index(["eventId"])
export class StaffPerformanceReview {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Değerlendirilen personel
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "staffId" })
  staff: User;

  @Column()
  staffId: string;

  // Değerlendiren lider
  @ManyToOne(() => User)
  @JoinColumn({ name: "reviewerId" })
  reviewer: User;

  @Column()
  reviewerId: string;

  // Etkinlik
  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column()
  eventId: string;

  // Genel Puan (0-100) - Kategori puanlarından hesaplanır
  @Column({ type: "int" })
  score: number;

  // Performans değerlendirmesi
  @Column({ type: "enum", enum: PerformanceRating })
  rating: PerformanceRating;

  // Kategori bazlı puanlar (JSON)
  @Column({ type: "jsonb", nullable: true })
  categoryScores: CategoryScores;

  // Güçlü yönler (array)
  @Column({ type: "jsonb", nullable: true, default: [] })
  strengths: string[];

  // Geliştirilmesi gereken alanlar (array)
  @Column({ type: "jsonb", nullable: true, default: [] })
  improvements: string[];

  // Genel yorum
  @Column({ type: "text", nullable: true })
  comment: string;

  // Özel notlar (sadece lider görebilir)
  @Column({ type: "text", nullable: true })
  privateNotes: string;

  // Önerilen eğitimler
  @Column({ type: "jsonb", nullable: true, default: [] })
  recommendedTrainings: string[];

  // Bir sonraki etkinlikte dikkat edilecekler
  @Column({ type: "text", nullable: true })
  nextEventNotes: string;

  // Değerlendirme tamamlandı mı?
  @Column({ type: "boolean", default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
