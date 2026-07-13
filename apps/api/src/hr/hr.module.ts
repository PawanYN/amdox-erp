/**
 * MODULE: hr.module.ts
 *
 * This file bundles together all the controllers and services for this specific feature.
 * It acts as the "glue" that tells NestJS how these files depend on each other.
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DepartmentController } from './department/department.controller';
import { DepartmentService } from './department/department.service';
import { EmployeeController } from './employee/employee.controller';
import { EmployeeService } from './employee/employee.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { PayrollController } from './payroll/payroll.controller';
import { PayrollService } from './payroll/payroll.service';
import { TaxSlabService } from './payroll/tax-slab.service';
import { PayrollProcessor } from './payroll/payroll.processor';
import { PayslipGenerator } from './payroll/payslip-generator';
import { LeaveStateMachine } from './leave/leave-state-machine';
import { ComplianceController } from './compliance/compliance.controller';
import { ComplianceService } from './compliance/compliance.service';

import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'payroll',
    }),
    TenantModule,
    SearchModule,
  ],
  controllers: [
    DepartmentController,
    EmployeeController,
    LeaveController,
    AttendanceController,
    PayrollController,
    ComplianceController,
  ],
  providers: [
    DepartmentService,
    EmployeeService,
    LeaveService,
    LeaveStateMachine,
    AttendanceService,
    PayrollService,
    TaxSlabService,
    PayrollProcessor,
    PayslipGenerator,
    ComplianceService,
  ],
})
export class HrModule {}
