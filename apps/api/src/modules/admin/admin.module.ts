import { Module } from '@nestjs/common';
import { AdminAccessService } from './application/admin-access.service.js';
import { AdminOperationsService } from './application/admin-operations.service.js';
import { AdminController } from './presentation/admin.controller.js';
import { AdminGuard } from './presentation/admin.guard.js';

/** Global operations access. It remains independent from Salon ownership. */
@Module({
  controllers: [AdminController],
  providers: [AdminAccessService, AdminOperationsService, AdminGuard],
  exports: [AdminAccessService, AdminGuard]
})
export class AdminModule {}
