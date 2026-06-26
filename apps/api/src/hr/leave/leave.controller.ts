import { Controller, Get, Post, Body, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from '../dto/create-leave.dto';
import { ApproveLeaveDto } from '../dto/approve-leave.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

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
  @Patch(':id/approve')
  approveOrReject(@Req() req: any, @Param('id') id: string, @Body() approveLeaveDto: ApproveLeaveDto) {
    const isTenantAdmin = req.user.roles.includes('TenantAdmin') || req.user.roles.includes('SuperAdmin');
    return this.leaveService.approveOrReject(req.user.tenantId, id, approveLeaveDto, isTenantAdmin);
  }
}
