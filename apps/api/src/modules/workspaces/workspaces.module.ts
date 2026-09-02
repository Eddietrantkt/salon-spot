import { Module } from '@nestjs/common';
import { SalonsModule } from '../salons/salons.module.js';
import { OwnerWorkspacesService } from './application/owner-workspaces.service.js';
import { WorkspacePublishingService } from './application/workspace-publishing.service.js';
import { OwnerWorkspacesController } from './presentation/owner-workspaces.controller.js';

/** Owns Workspace authoring, publication rules and rental-option configuration. */
@Module({
  imports: [SalonsModule],
  controllers: [OwnerWorkspacesController],
  providers: [OwnerWorkspacesService, WorkspacePublishingService]
})
export class WorkspacesModule {}
