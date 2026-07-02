import { Controller, Post, Get, Body, Req, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ResourceService } from './resource.service';
import { AllocateResourceDto } from '../dto/allocate-resource.dto';

@ApiTags('Project Management - Resources')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('pm/resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.tenantId || 'default-tenant-id';
  }

  @Get()
  @ApiOperation({ summary: 'List resource allocations' })
  list(@Req() req: any) {
    return this.resourceService.listAllocations(this.tenantId(req));
  }

  @Post('allocate')
  allocateResource(@Req() req: any, @Body() dto: AllocateResourceDto) {
    return this.resourceService.allocateResource(this.tenantId(req), dto);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Team utilisation heatmap data' })
  getHeatmap(@Req() req: any, @Query('employeeId') employeeId?: string) {
    return this.resourceService.getUtilisationHeatmap(
      this.tenantId(req),
      employeeId,
    );
  }

  @Get('heatmap/:employeeId')
  getHeatmapForEmployee(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.resourceService.getUtilisationHeatmap(
      this.tenantId(req),
      employeeId,
    );
  }
}
