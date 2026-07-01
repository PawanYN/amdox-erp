import { Controller, Post, Get, Body, Req, Param, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ClockInDto } from '../dto/clock-in.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles('Employee', 'Manager', 'TenantAdmin')
  @Post('clock-in')
  clockIn(@Req() req: any, @Body() clockInDto: ClockInDto) {
    return this.attendanceService.clockIn(req.user.tenantId, clockInDto);
  }

  @Roles('Employee', 'Manager', 'TenantAdmin')
  @Post('clock-out/:employeeId')
  clockOut(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.attendanceService.clockOut(req.user.tenantId, employeeId);
  }

  @Roles('Employee', 'Manager', 'TenantAdmin', 'SuperAdmin')
  @Get('status/:employeeId')
  getStatus(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.attendanceService.getStatus(req.user.tenantId, employeeId);
  }

  @Roles('Employee', 'Manager', 'TenantAdmin', 'SuperAdmin')
  @Get('my-records/:employeeId')
  getMyRecords(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.attendanceService.getMyRecords(req.user.tenantId, employeeId);
  }

  @Roles('Manager', 'TenantAdmin', 'Tenant Admin', 'SuperAdmin')
  @Get('all')
  getAllRecords(@Req() req: any) {
    return this.attendanceService.getAllRecords(req.user.tenantId);
  }
}
