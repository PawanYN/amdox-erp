/**
 * MODULE: hr.module.ts
 * 
 * This file bundles together all the controllers and services for this specific feature.
 * It acts as the "glue" that tells NestJS how these files depend on each other.
 */
import { Module } from '@nestjs/common';
import { DepartmentController } from './department/department.controller';
import { DepartmentService } from './department/department.service';
import { EmployeeController } from './employee/employee.controller';
import { EmployeeService } from './employee/employee.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';

@Module({
  controllers: [DepartmentController, EmployeeController, LeaveController, AttendanceController],
  providers: [DepartmentService, EmployeeService, LeaveService, AttendanceService],
})
export class HrModule { }
