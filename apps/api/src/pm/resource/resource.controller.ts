import { Controller, Post, Get, Body, Req, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ResourceService } from './resource.service';
import { AllocateResourceDto } from '../dto/allocate-resource.dto';

@ApiTags('Project Management - Resources')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('pm/resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.tenantId || 'default-tenant-id';
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  @ApiOperation({ summary: 'List resource allocations' })
  list(@Req() req: any) {
    return this.resourceService.listAllocations(this.tenantId(req));
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('allocate')
  allocateResource(@Req() req: any, @Body() dto: AllocateResourceDto) {
    return this.resourceService.allocateResource(this.tenantId(req), dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('heatmap')
  @ApiOperation({ summary: 'Team utilisation heatmap data' })
  getHeatmap(@Req() req: any, @Query('employeeId') employeeId?: string) {
    return this.resourceService.getUtilisationHeatmap(
      this.tenantId(req),
      employeeId,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('heatmap/:employeeId')
  getHeatmapForEmployee(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.resourceService.getUtilisationHeatmap(
      this.tenantId(req),
      employeeId,
    );
  }
}
