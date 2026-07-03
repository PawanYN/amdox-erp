import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Response } from 'express';
import { interval, mergeMap, Observable } from 'rxjs';
import * as fs from 'fs';
import { BiService } from './bi.service';
import { BiDataService, BiDataSource, BiFilters } from './bi-data.service';
import { BiReportService } from './bi-report.service';
import {
  AddWidgetDto,
  BiFilterQueryDto,
  CreateScheduledReportDto,
  DrillDownDto,
  UpdateWidgetDto,
} from './dto/bi.dto';

@ApiTags('Business Intelligence')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('bi')
export class BiController {
  constructor(
    private readonly biService: BiService,
    private readonly biDataService: BiDataService,
    private readonly biReportService: BiReportService,
  ) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
  }

  private parseFilters(query: BiFilterQueryDto): BiFilters {
    return {
      period: query.period,
      department: query.department,
      status: query.status,
    };
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('dashboards')
  @ApiOperation({ summary: 'List saved dashboards' })
  listDashboards(@Req() req: any) {
    return this.biService.listDashboards(this.tenantId(req));
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('dashboards/:id')
  @ApiOperation({ summary: 'Get dashboard with widgets' })
  getDashboard(@Req() req: any, @Param('id') id: string) {
    return this.biService.getDashboard(this.tenantId(req), id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('dashboards')
  @ApiOperation({ summary: 'Create a dashboard shell' })
  createDashboard(@Req() req: any, @Body('name') name: string) {
    return this.biService.createDashboard(
      this.tenantId(req),
      name,
      req.user?.sub,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch('dashboards/:id')
  @ApiOperation({ summary: 'Update dashboard name or layout' })
  updateDashboard(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; layout?: object },
  ) {
    return this.biService.updateDashboard(this.tenantId(req), id, body);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Delete('dashboards/:id')
  @ApiOperation({ summary: 'Soft-delete a dashboard' })
  deleteDashboard(@Req() req: any, @Param('id') id: string) {
    return this.biService.deleteDashboard(this.tenantId(req), id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('dashboards/widgets')
  @ApiOperation({ summary: 'Add widget to dashboard' })
  addWidget(@Req() req: any, @Body() dto: AddWidgetDto) {
    return this.biService.addWidget(
      this.tenantId(req),
      dto.dashboardId,
      dto.type,
      dto.config,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch('widgets/:id')
  @ApiOperation({ summary: 'Update widget type or config' })
  updateWidget(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateWidgetDto,
  ) {
    return this.biService.updateWidget(this.tenantId(req), id, body);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Delete('widgets/:id')
  @ApiOperation({ summary: 'Delete a widget' })
  deleteWidget(@Req() req: any, @Param('id') id: string) {
    return this.biService.deleteWidget(this.tenantId(req), id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('widgets/:id/data')
  @ApiOperation({ summary: 'Resolve widget chart data from JSON config' })
  async getWidgetData(
    @Req() req: any,
    @Param('id') id: string,
    @Query() query: BiFilterQueryDto,
  ) {
    const widget = await this.biService.getWidget(this.tenantId(req), id);
    const config = widget.config as { dataSource?: BiDataSource; title?: string };
    const dataSource = (config.dataSource || 'ar_aging') as BiDataSource;
    const filters = this.parseFilters(query);
    const data = await this.biDataService.getWidgetData(
      this.tenantId(req),
      dataSource,
      filters,
    );
    return { widget, ...data };
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('data/:source')
  @ApiOperation({ summary: 'Fetch chart data by source key' })
  getDataBySource(
    @Req() req: any,
    @Param('source') source: BiDataSource,
    @Query() query: BiFilterQueryDto,
  ) {
    return this.biDataService.getWidgetData(
      this.tenantId(req),
      source,
      this.parseFilters(query),
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Post('drill-down')
  @ApiOperation({ summary: 'Drill-down: chart segment → filtered table rows' })
  drillDown(@Req() req: any, @Body() dto: DrillDownDto) {
    return this.biDataService.getDrillDown(
      this.tenantId(req),
      dto.dataSource as BiDataSource,
      dto.filterKey,
      dto.filterValue,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('kpis')
  @ApiOperation({ summary: 'Executive KPI aggregates for dashboards' })
  getKpis(@Req() req: any, @Query() query: BiFilterQueryDto) {
    return this.biService.getExecutiveKpis(
      this.tenantId(req),
      this.parseFilters(query),
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Sse('metrics/stream')
  @ApiOperation({ summary: 'Real-time KPI refresh via Server-Sent Events' })
  streamMetrics(@Req() req: any, @Query() query: BiFilterQueryDto): Observable<MessageEvent> {
    const tenantId = this.tenantId(req);
    const filters = this.parseFilters(query);
    return interval(5000).pipe(
      mergeMap(async () => {
        const kpis = await this.biService.getExecutiveKpis(tenantId, filters);
        return { data: kpis } as MessageEvent;
      }),
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('reports')
  @ApiOperation({ summary: 'List scheduled BI reports' })
  listReports(@Req() req: any) {
    return this.biReportService.listReports(this.tenantId(req));
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('reports')
  @ApiOperation({ summary: 'Create scheduled report (PDF/Excel + email)' })
  createReport(@Req() req: any, @Body() dto: CreateScheduledReportDto) {
    return this.biReportService.createReport(this.tenantId(req), dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Delete('reports/:id')
  @ApiOperation({ summary: 'Delete scheduled report' })
  deleteReport(@Req() req: any, @Param('id') id: string) {
    return this.biReportService.deleteReport(this.tenantId(req), id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('reports/:id/run')
  @ApiOperation({ summary: 'Run scheduled report now' })
  runReport(@Req() req: any, @Param('id') id: string) {
    return this.biReportService.runReport(this.tenantId(req), id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('reports/:id/download')
  @ApiOperation({ summary: 'Download last generated report file' })
  async downloadReport(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.biReportService.getReportFile(this.tenantId(req), id);
    const contentType =
      file.format === 'EXCEL'
        ? 'text/csv'
        : 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.name}.${file.format === 'EXCEL' ? 'csv' : 'pdf'}"`,
    );
    fs.createReadStream(file.path).pipe(res);
  }
}
