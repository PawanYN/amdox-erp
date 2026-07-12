import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || 'default-tenant-id';
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  @ApiOperation({ summary: 'Full-text search across vendors and products' })
  search(@Req() req: any, @Query('q') q: string, @Query('limit') limit?: string) {
    return this.searchService.search(this.tenantId(req), q || '', limit ? parseInt(limit, 10) : 20);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Post('reindex')
  @ApiOperation({ summary: 'Reindex tenant data into Elasticsearch' })
  reindex(@Req() req: any) {
    return this.searchService.reindexAll(this.tenantId(req));
  }
}
