import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

// Entities
import {
  User,
  Customer,
  Event,
  Reservation,
  TableType,
  VenueTemplate,
  StaffAssignment,
  ServiceTeam,
  SystemSettings,
  StaffColor,
  InvitationTemplate,
  EventInvitation,
  GuestNote,
} from "./entities";

// Modules
import { AuthModule } from "./modules/auth/auth.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { EventsModule } from "./modules/events/events.module";
import { ReservationsModule } from "./modules/reservations/reservations.module";
import { VenuesModule } from "./modules/venues/venues.module";
import { TablesModule } from "./modules/tables/tables.module";
import { StaffModule } from "./modules/staff/staff.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { UploadModule } from "./modules/upload/upload.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    // Static dosyalar için (uploads klasörü)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads",
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST", "localhost"),
        port: configService.get("DB_PORT", 5432),
        username: configService.get("DB_USERNAME", "postgres"),
        password: configService.get("DB_PASSWORD", "postgres"),
        database: configService.get("DB_NAME", "eventflow"),
        entities: [
          User,
          Customer,
          Event,
          Reservation,
          TableType,
          VenueTemplate,
          StaffAssignment,
          ServiceTeam,
          SystemSettings,
          StaffColor,
          InvitationTemplate,
          EventInvitation,
          GuestNote,
        ],
        synchronize: configService.get("NODE_ENV") !== "production",
        logging: configService.get("NODE_ENV") === "development",
      }),
    }),
    AuthModule,
    CustomersModule,
    EventsModule,
    ReservationsModule,
    VenuesModule,
    TablesModule,
    StaffModule,
    RealtimeModule,
    SettingsModule,
    UploadModule,
    InvitationsModule,
  ],
})
export class AppModule {}
