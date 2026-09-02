import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppConfigModule } from './common/config/app-config.module.js';
import { PrismaModule } from './common/database/prisma/prisma.module.js';
import { HealthModule } from './common/health/health.module.js';
import { RequestIdMiddleware } from './common/http/request-id.middleware.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AvailabilityModule } from './modules/availability/availability.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { DiscoveryModule } from './modules/discovery/discovery.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ProfessionalsModule } from './modules/professionals/professionals.module.js';
import { SalonsModule } from './modules/salons/salons.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProfessionalsModule,
    SalonsModule,
    WorkspacesModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    MediaModule,
    ChatModule,
    AdminModule,
    DiscoveryModule
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
