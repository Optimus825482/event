import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("work_locations")
@Index("IDX_work_locations_name", ["name"], { unique: true })
@Index("IDX_work_locations_is_active", ["isActive"])
export class WorkLocation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  // Adres bilgisi
  @Column({ nullable: true })
  address: string;

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
