import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReservationsController } from "./reservations.controller";
import { ReservationsService } from "./reservations.service";
import { CheckInService } from "./check-in.service";
import { ReservationCrmService } from "./reservation-crm.service";
import { ReservationStatsService } from "./reservation-stats.service";
import { QREngineService } from "./qr-engine.service";
import { Reservation } from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import { Customer } from "../../entities/customer.entity";
import { RealtimeModule } from "../realtime/realtime.module";
import { MailModule } from "../mail/mail.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Event, Customer]),
    RealtimeModule,
    MailModule,
    SettingsModule,
  ],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    CheckInService,
    ReservationCrmService,
    ReservationStatsService,
    QREngineService,
  ],
  exports: [
    ReservationsService,
    CheckInService,
    ReservationCrmService,
    ReservationStatsService,
    QREngineService,
  ],
})
export class ReservationsModule {}
