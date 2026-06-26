/**
 * CONTROLLER: payroll.controller.ts
 * 
 * Receives HR payroll HTTP requests and routes them to the payroll service.
 */
import { Controller, Get, Post, Query, Body, Param, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { RunPayrollDto } from '../dto/run-payroll.dto';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Roles('Manager', 'TenantAdmin')
  @Post('run')
  async runPayroll(@Req() req: any, @Body() runPayrollDto: RunPayrollDto) {
    const result = await this.payrollService.enqueuePayrollRun(req.user.tenantId, runPayrollDto.payPeriod);
    return {
      payrollRunId: result.payrollRunId,
      jobId: result.payrollRunId,
      status: result.status,
    };
  }

  @Roles('Manager', 'TenantAdmin', 'Employee')
  @Get()
  async getPayroll(@Req() req: any, @Query('period') period: string) {
    return { data: await this.payrollService.findPayrollByPeriod(req.user.tenantId, period) };
  }

  @Roles('Manager', 'TenantAdmin')
  @Get('runs/:id')
  async getPayrollRun(@Req() req: any, @Param('id') id: string) {
    return await this.payrollService.getPayrollRun(req.user.tenantId, id);
  }

  @Roles('Manager', 'TenantAdmin')
  @Get('runs/:id/payslips')
  async getPayrollRunPayslips(@Req() req: any, @Param('id') id: string) {
    return { data: await this.payrollService.getPayslipsForRun(req.user.tenantId, id) };
  }

  @Roles('Manager', 'TenantAdmin')
  @Get(':payslipId/payslip')
  async downloadPayslip(@Req() req: any, @Param('payslipId') payslipId: string, @Res() res: Response) {
    const pdfBuffer = await this.payrollService.getPayslipPdf(req.user.tenantId, payslipId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslipId}.pdf"`);
    res.send(pdfBuffer);
  }
}
