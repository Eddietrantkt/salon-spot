import { Module } from '@nestjs/common';
import { SearchWorkspacesService } from './application/search-workspaces.service.js';
import { DiscoveryController } from './presentation/discovery.controller.js';

@Module({ controllers: [DiscoveryController], providers: [SearchWorkspacesService] })
export class DiscoveryModule {}
