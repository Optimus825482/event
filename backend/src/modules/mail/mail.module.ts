import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailService } from "./mail.service";
import { SystemSettings } from "../../entities/settings.entity";

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
