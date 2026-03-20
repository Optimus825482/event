import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";
import { InvitationTemplate } from "../../entities/invitation-template.entity";
import { EventInvitation } from "../../entities/event-invitation.entity";
import { Reservation } from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import { SystemSettings } from "../../entities/settings.entity";
import { MailModule } from "../mail/mail.module";
import { SettingsModule } from "../settings/settings.module";

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
    SettingsModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
