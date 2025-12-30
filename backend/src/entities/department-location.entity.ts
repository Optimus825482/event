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
import { WorkLocation } from "./work-location.entity";

@Entity("department_locations")
@Unique("UQ_department_location", ["departmentId", "workLocationId"])
@Index("IDX_dept_loc_department", ["departmentId"])
@Index("IDX_dept_loc_location", ["workLocationId"])
export class DepartmentLocation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  departmentId: string;

  @Column()
  workLocationId: string;

  @ManyToOne(() => Department, { onDelete: "CASCADE" })
  @JoinColumn({ name: "departmentId" })
  department: Department;

  @ManyToOne(() => WorkLocation, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workLocationId" })
  workLocation: WorkLocation;

  @CreateDateColumn()
  createdAt: Date;
}
