import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";
import {
  InvitationTemplate,
  EventInvitation,
} from "../../entities/invitation-template.entity";
import { Reservation } from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import { SystemSettings } from "../../entities/settings.entity";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvitationTemplate,
      EventInvitation,
      Reservation,
      Event,
      SystemSettings,
    ]),
    MailModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
