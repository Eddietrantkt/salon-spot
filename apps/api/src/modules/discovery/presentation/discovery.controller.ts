import { Controller, Get, Query } from '@nestjs/common';
import type { WorkspaceSearchResponse } from '@salon-spot/contracts';
import { SearchWorkspacesService } from '../application/search-workspaces.service.js';
import { SearchWorkspacesQuery } from './dto/search-workspaces.query.js';

@Controller('workspaces')
export class DiscoveryController {
  constructor(private readonly searchWorkspaces: SearchWorkspacesService) {}

  @Get()
  search(@Query() query: SearchWorkspacesQuery): Promise<WorkspaceSearchResponse> {
    return this.searchWorkspaces.search(query);
  }
}
