/**
 * CONTROLLER: payroll.controller.ts
 *
 * Receives HR payroll HTTP requests and routes them to the payroll service.
 */
import { Controller, Get, Post, Query, Body, Param, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule, SkipModuleCheck } from '../../auth/decorators/require-module.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { RunPayrollDto } from '../dto/run-payroll.dto';
import { EmployeeService } from '../employee/employee.service';

@ApiTags('Payroll')
@ApiBearerAuth()
@RequireModule('hr')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly employeeService: EmployeeService,
  ) {}

  @Roles('Manager', 'TenantAdmin', 'Tenant Admin')
  @Post('run')
  async runPayroll(@Req() req: any, @Body() runPayrollDto: RunPayrollDto) {
    const result = await this.payrollService.enqueuePayrollRun(
      req.user.tenantId,
      runPayrollDto.payPeriod,
    );
    return {
      payrollRunId: result.payrollRunId,
      jobId: result.payrollRunId,
      status: result.status,
    };
  }

  @Roles('Manager', 'TenantAdmin', 'Tenant Admin', 'Employee')
  @Get()
  async getPayroll(@Req() req: any, @Query('period') period: string) {
    return { data: await this.payrollService.findPayrollByPeriod(req.user.tenantId, period) };
  }

  /**
   * Personal payslip for the caller only — intentionally bypasses the `hr` module
   * gate (self-service data, like `GET /employees/me`) and is scoped server-side
   * to the caller's own employeeId so it can never leak a co-worker's salary.
   */
  @Roles('Employee', 'Manager', 'TenantAdmin', 'Tenant Admin', 'SuperAdmin')
  @SkipModuleCheck()
  @Get('mine')
  async getMyPayroll(@Req() req: any, @Query('period') period: string) {
    const me = await this.employeeService.findMe(req.user.tenantId, req.user.id);
    return { data: await this.payrollService.findMyPayslip(req.user.tenantId, me.id, period) };
  }

  @Roles('Manager', 'TenantAdmin', 'Tenant Admin')
  @Get('runs/:id')
  async getPayrollRun(@Req() req: any, @Param('id') id: string) {
    return await this.payrollService.getPayrollRun(req.user.tenantId, id);
  }

  @Roles('Manager', 'TenantAdmin', 'Tenant Admin')
  @Get('runs/:id/payslips')
  async getPayrollRunPayslips(@Req() req: any, @Param('id') id: string) {
    return { data: await this.payrollService.getPayslipsForRun(req.user.tenantId, id) };
  }

  @Roles('Manager', 'TenantAdmin', 'Tenant Admin')
  @Get(':payslipId/payslip')
  async downloadPayslip(
    @Req() req: any,
    @Param('payslipId') payslipId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.payrollService.getPayslipPdf(req.user.tenantId, payslipId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslipId}.pdf"`);
    res.send(pdfBuffer);
  }

  /**
   * Self-service payslip download — bypasses the `hr` module gate (personal data,
   * like `GET /employees/me`) and is ALWAYS scoped to the caller's own employeeId
   * (resolved server-side via findMe), so it can never serve a co-worker's PDF
   * regardless of role.
   */
  @Roles('Employee', 'Manager', 'TenantAdmin', 'Tenant Admin', 'SuperAdmin')
  @SkipModuleCheck()
  @Get('mine/:payslipId/payslip')
  async downloadMyPayslip(
    @Req() req: any,
    @Param('payslipId') payslipId: string,
    @Res() res: Response,
  ) {
    const me = await this.employeeService.findMe(req.user.tenantId, req.user.id);
    const pdfBuffer = await this.payrollService.getPayslipPdf(req.user.tenantId, payslipId, me.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslipId}.pdf"`);
    res.send(pdfBuffer);
  }
}
