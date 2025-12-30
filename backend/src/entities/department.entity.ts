import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("departments")
@Index("IDX_departments_name", ["name"], { unique: true })
@Index("IDX_departments_is_active", ["isActive"])
export class Department {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  // Renk kodu (UI'da gösterim için)
  @Column({ nullable: true })
  color: string;

  // Sıralama için
  @Column({ type: "int", default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
