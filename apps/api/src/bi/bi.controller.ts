import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BiService } from './bi.service';

@ApiTags('Business Intelligence')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('bi')
export class BiController {
  constructor(private readonly biService: BiService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
  }

  @Get('dashboards')
  @ApiOperation({ summary: 'List saved dashboards' })
  listDashboards(@Req() req: any) {
    return this.biService.listDashboards(this.tenantId(req));
  }

  @Post('dashboards')
  @ApiOperation({ summary: 'Create a dashboard shell' })
  createDashboard(@Req() req: any, @Body('name') name: string) {
    return this.biService.createDashboard(
      this.tenantId(req),
      name,
      req.user?.sub,
    );
  }

  @Post('dashboards/widgets')
  @ApiOperation({ summary: 'Add widget to dashboard' })
  addWidget(
    @Req() req: any,
    @Body('dashboardId') dashboardId: string,
    @Body('type') type: string,
    @Body('config') config: object,
  ) {
    return this.biService.addWidget(
      this.tenantId(req),
      dashboardId,
      type,
      config,
    );
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Executive KPI aggregates for dashboards' })
  getKpis(@Req() req: any) {
    return this.biService.getExecutiveKpis(this.tenantId(req));
  }
}
