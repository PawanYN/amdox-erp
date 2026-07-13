import { Controller, Get, Post, Body, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveAccrualService } from './leave-accrual.service';
import { CreateLeaveDto } from '../dto/create-leave.dto';
import { ApproveLeaveDto, LeaveStatus } from '../dto/approve-leave.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly leaveAccrualService: LeaveAccrualService,
  ) {}

  @Roles('Employee', 'Manager', 'TenantAdmin', 'SuperAdmin')
  @Post()
  createRequest(@Req() req: any, @Body() createLeaveDto: CreateLeaveDto) {
    return this.leaveService.createRequest(req.user.tenantId, createLeaveDto);
  }

  @Roles('Employee', 'Manager', 'TenantAdmin', 'SuperAdmin')
  @Get('my-requests/:employeeId')
  getMyRequests(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.leaveService.getMyRequests(req.user.tenantId, employeeId);
  }

  @Roles('Manager', 'TenantAdmin', 'SuperAdmin')
  @Get('all-requests')
  getAllRequests(@Req() req: any) {
    return this.leaveService.getAllRequests(req.user.tenantId);
  }

  @Roles('Employee', 'Manager', 'TenantAdmin', 'SuperAdmin')
  @Get('my-balances/:employeeId')
  getMyBalances(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.leaveService.getMyBalances(req.user.tenantId, employeeId);
  }

  /**
   * Manually runs this tenant's monthly accrual immediately, instead of
   * waiting for the 1st-of-month cron (LeaveAccrualScheduler) — for admins
   * who want to grant this month's days early, and for testing the flow.
   */
  @Roles('TenantAdmin', 'SuperAdmin')
  @Post('run-accrual')
  runAccrual(@Req() req: any) {
    return this.leaveAccrualService.runAccrual(req.user.tenantId);
  }

  @Roles('Manager', 'TenantAdmin', 'Tenant Admin', 'SuperAdmin')
  @Patch(':id/approve')
  approveOrReject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() approveLeaveDto: ApproveLeaveDto,
  ) {
    const roles = req.user?.roles || [];
    const isTenantAdmin =
      roles.includes('TenantAdmin') ||
      roles.includes('Tenant Admin') ||
      roles.includes('SuperAdmin');

    console.log(
      `[LeaveController] Approving leave ${id}. User roles:`,
      roles,
      `| isTenantAdmin:`,
      isTenantAdmin,
    );

    return this.leaveService.approveOrReject(req.user.tenantId, id, approveLeaveDto, isTenantAdmin);
  }

  /** Thin alias — same service path as approve with status forced to rejected. */
  @Roles('Manager', 'TenantAdmin', 'Tenant Admin', 'SuperAdmin')
  @Patch(':id/reject')
  reject(
    @Req() req: any,
    @Param('id') id: string,
    @Body('managerEmployeeId') managerEmployeeId: string,
  ) {
    const roles = req.user?.roles || [];
    const isTenantAdmin =
      roles.includes('TenantAdmin') ||
      roles.includes('Tenant Admin') ||
      roles.includes('SuperAdmin');
    return this.leaveService.approveOrReject(
      req.user.tenantId,
      id,
      { status: LeaveStatus.REJECTED, managerEmployeeId },
      isTenantAdmin,
    );
  }
}
