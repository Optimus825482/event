import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { Customer } from "../../entities/customer.entity";
import { GuestNote } from "../../entities/guest-note.entity";
import { Reservation } from "../../entities/reservation.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Customer, GuestNote, Reservation])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
