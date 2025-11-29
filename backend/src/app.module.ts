import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import {
  User,
  Customer,
  Event,
  Reservation,
  TableType,
  VenueTemplate,
  StaffAssignment,
  SystemSettings,
  StaffColor,
} from './entities';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { EventsModule } from './modules/events/events.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { VenuesModule } from './modules/venues/venues.module';
import { TablesModule } from './modules/tables/tables.module';
import { StaffModule } from './modules/staff/staff.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_NAME', 'eventflow'),
        entities: [
          User,
          Customer,
          Event,
          Reservation,
          TableType,
          VenueTemplate,
          StaffAssignment,
          SystemSettings,
          StaffColor,
        ],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
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
  ],
})
export class AppModule {}
