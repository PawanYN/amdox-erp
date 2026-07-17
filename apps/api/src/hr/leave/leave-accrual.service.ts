import { Injectable } from '@nestjs/common';
import { prisma, EmploymentStatus } from '@amdox/db';
import { AmdoxLogger } from '../../infrastructure/common/logger/amdox-logger';

/**
 * WHAT: Grants each active employee `leaveType.accrualRate` additional days
 * on their balance for every leave type that has a non-zero rate.
 * WHY: `LeaveBalance` previously only got its one-time starting value at
 * employee creation — nothing ever added to it afterwards, so "accrual" was
 * a schema field with no behaviour behind it.
 */
@Injectable()
export class LeaveAccrualService {
  /** Runs for one tenant, or every tenant when `tenantId` is omitted (cron path). */
  async runAccrual(tenantId?: string) {
    const tenants = tenantId
      ? [{ id: tenantId }]
      : await prisma.tenant.findMany({ where: { isActive: true }, select: { id: true } });

    let totalGrants = 0;

    for (const tenant of tenants) {
      // tenant-scope-ok: every query below is explicitly filtered by this loop's tenant.id.
      const leaveTypes = await prisma.leaveType.findMany({
        where: { tenantId: tenant.id, accrualRate: { gt: 0 } },
      });
      if (leaveTypes.length === 0) continue;

      const employees = await prisma.employee.findMany({
        where: { tenantId: tenant.id, status: EmploymentStatus.ACTIVE },
        select: { id: true },
      });
      if (employees.length === 0) continue;

      for (const leaveType of leaveTypes) {
        for (const employee of employees) {
          await prisma.leaveBalance.upsert({
            where: {
              employeeId_leaveTypeId: { employeeId: employee.id, leaveTypeId: leaveType.id },
            },
            update: { balanceDays: { increment: leaveType.accrualRate } },
            create: {
              tenantId: tenant.id,
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              balanceDays: leaveType.accrualRate,
            },
          });
          totalGrants++;
        }
      }
    }

    AmdoxLogger.hr(
      `Leave accrual run complete`,
      `tenants=${tenants.length}  grants=${totalGrants}`,
    );
    return { tenantsProcessed: tenants.length, grantsApplied: totalGrants };
  }
}
