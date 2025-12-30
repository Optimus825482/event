import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { Department } from "./department.entity";
import { Position } from "./position.entity";

@Entity("department_positions")
@Unique("UQ_department_position", ["departmentId", "positionId"])
@Index("IDX_dept_pos_department", ["departmentId"])
@Index("IDX_dept_pos_position", ["positionId"])
export class DepartmentPosition {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  departmentId: string;

  @Column()
  positionId: string;

  @ManyToOne(() => Department, { onDelete: "CASCADE" })
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @ManyToOne(() => Position, { onDelete: "CASCADE" })
  @JoinColumn({ name: "positionId" })
  position: Position;

  @CreateDateColumn()
  createdAt: Date;
}
