import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReservationsController } from "./reservations.controller";
import { ReservationsService } from "./reservations.service";
import { QREngineService } from "./qr-engine.service";
import { Reservation } from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import { Customer } from "../../entities/customer.entity";
import { RealtimeModule } from "../realtime/realtime.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Event, Customer]),
    RealtimeModule,
    MailModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, QREngineService],
  exports: [ReservationsService, QREngineService],
})
export class ReservationsModule {}
