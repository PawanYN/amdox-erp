import { Controller, Post, Body, Req, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ResourceService } from './resource.service';
import { AllocateResourceDto } from '../dto/allocate-resource.dto';

@ApiTags('Project Management - Resources')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('pm/resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post('allocate')
  allocateResource(@Req() req: any, @Body() dto: AllocateResourceDto) {
    const tenantId = req.tenantId || 'default-tenant-id'; 
    return this.resourceService.allocateResource(tenantId, dto);
  }

  @Get('heatmap/:employeeId')
  getHeatmap(@Req() req: any, @Param('employeeId') employeeId: string) {
    const tenantId = req.tenantId || 'default-tenant-id'; 
    return this.resourceService.getUtilisationHeatmap(tenantId, employeeId);
  }
}
