import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { join } from "path";

// Config
import { validateEnv } from "./config/env.validation";

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
  TableGroup,
  StaffRole,
  WorkShift,
  Team,
  EventStaffAssignment,
  OrganizationTemplate,
  Staff,
  Position,
  Department,
  WorkLocation,
  DepartmentPosition,
  DepartmentLocation,
  ServicePoint,
  ServicePointStaffAssignment,
  EventExtraStaff,
} from "./entities";
import { StaffPerformanceReview } from "./entities/staff-performance-review.entity";
import { Notification, NotificationRead } from "./entities/notification.entity";

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
import { UsersModule } from "./modules/users/users.module";
import { LeaderModule } from "./modules/leader/leader.module";
import { HealthModule } from "./modules/health/health.module";
import { AdminModule } from "./modules/admin/admin.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";

@Module({
  imports: [
    // ==================== CONFIG ====================
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validate: validateEnv,
    }),

    // ==================== RATE LIMITING ====================
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: "default",
            ttl: parseInt(configService.get("THROTTLE_TTL") || "60000", 10), // 60 saniye
            limit: parseInt(configService.get("THROTTLE_LIMIT") || "200", 10), // 200 istek (artırıldı)
          },
          {
            name: "auth",
            ttl: 60000, // 60 saniye
            limit: 10, // Auth için daha sıkı limit
          },
        ],
      }),
    }),

    // ==================== STATIC FILES ====================
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads",
    }),

    // ==================== DATABASE ====================
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
          TableGroup,
          StaffRole,
          WorkShift,
          Team,
          EventStaffAssignment,
          OrganizationTemplate,
          StaffPerformanceReview,
          Notification,
          NotificationRead,
          Staff,
          Position,
          Department,
          WorkLocation,
          DepartmentPosition,
          DepartmentLocation,
          ServicePoint,
          ServicePointStaffAssignment,
          EventExtraStaff,
        ],
        // UYARI: Production'da synchronize: false olmalı!
        synchronize: false,
        logging:
          configService.get("NODE_ENV") === "development"
            ? ["query", "error", "warn", "schema"]
            : ["error"],
        // Slow query logging - threshold üzeri sorguları logla
        maxQueryExecutionTime: parseInt(
          configService.get("SLOW_QUERY_THRESHOLD") || "500",
          10
        ),
        // Connection pool ayarları - Optimize edilmiş
        extra: {
          max: parseInt(configService.get("DB_POOL_MAX") || "50", 10),
          min: parseInt(configService.get("DB_POOL_MIN") || "10", 10),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          query_timeout: 30000,
          statement_timeout: 60000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
          application_name: `eventflow_${
            configService.get("NODE_ENV") || "dev"
          }`,
        },
      }),
    }),

    // ==================== FEATURE MODULES ====================
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
    UsersModule,
    LeaderModule,
    HealthModule,
    AdminModule,
    NotificationsModule,
  ],
  providers: [
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
