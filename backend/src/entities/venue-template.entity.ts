import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('venue_templates')
export class VenueTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  layoutData: {
    walls: Array<{ id: string; points: number[] }>;
    stage: { x: number; y: number; width: number; height: number };
    fixedAreas: Array<{ id: string; type: string; x: number; y: number; width: number; height: number }>;
    dimensions: { width: number; height: number };
  };

  @Column({ default: false })
  isPublic: boolean;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
