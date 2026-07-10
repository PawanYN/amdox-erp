import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, EmploymentStatus } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { TenantService } from '../../tenant/tenant.service';
import { filterAssignableModules } from '../../auth/erp-modules';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, createEmployeeDto: CreateEmployeeDto, actingUserId?: string) {
    // Prisma requires strict Date objects, so we safely convert the string from the DTO
    const employee = await prisma.employee.create({
      data: {
        fullName: createEmployeeDto.firstName + ' ' + createEmployeeDto.lastName,
        email: createEmployeeDto.email,
        designation: createEmployeeDto.designation,
        hireDate: new Date(createEmployeeDto.hireDate),
        tenantId,
        departmentId: createEmployeeDto.departmentId,
        managerId: createEmployeeDto.managerId,
        allowedModules: filterAssignableModules(createEmployeeDto.allowedModules),
      },
    });
    console.log(
      `\x1b[32m[PRISMA EMPLOYEE CREATED] Inserted Employee ID: ${employee.id} (${employee.fullName})\x1b[0m`,
    );

    const defaultLeaveTypes = await prisma.leaveType.findMany({
      where: { tenantId },
    });

    if (defaultLeaveTypes.length > 0) {
      const result = await prisma.leaveBalance.createMany({
        data: defaultLeaveTypes.map((lt) => ({
          tenantId,
          employeeId: employee.id,
          leaveTypeId: lt.id,
          balanceDays: lt.name === 'Annual Leave' ? 14 : lt.name === 'Sick Leave' ? 6 : 0,
        })),
      });
      console.log(
        `\x1b[35m[PRISMA LEAVE BALANCES] Seeded ${result.count} leave balance records for Employee ${employee.id}\x1b[0m`,
      );
    }

    // Payroll only reads salary from EmploymentContract, never from the Employee
    // row — without this, the employee is silently skipped by every payroll run.
    if (createEmployeeDto.salary !== undefined && createEmployeeDto.salary !== null) {
      await prisma.employmentContract.create({
        data: {
          tenantId,
          employeeId: employee.id,
          jobTitle: createEmployeeDto.designation || 'Employee',
          salary: createEmployeeDto.salary,
          currencyCode: createEmployeeDto.currencyCode || 'INR',
          startDate: new Date(createEmployeeDto.hireDate),
        },
      });
    }

    const fullName = createEmployeeDto.firstName + ' ' + createEmployeeDto.lastName;
    const shouldProvision = createEmployeeDto.provideErpAccess !== false;

    try {
      if (!shouldProvision) {
        this.eventEmitter.emit('employee.created', {
          tenantId,
          employeeId: employee.id,
          userId: actingUserId,
        });
        return employee;
      }

      const systemRole = createEmployeeDto.systemRole ?? 'Employee';
      const userId = await this.tenantService.provisionEmployeeUser(
        tenantId,
        createEmployeeDto.email,
        fullName,
        systemRole,
      );

      // tenant-scope-ok: employee.id is the record we just created above in this
      // same function call, scoped to `tenantId` — not attacker-supplied.
      const updatedEmployee = await prisma.employee.update({
        where: { id: employee.id },
        data: { userId },
      });
      console.log(
        `\x1b[38;2;99;102;241m[EMPLOYEE CREATED] ${JSON.stringify(updatedEmployee, null, 2)}\x1b[0m`,
      );
      console.log(
        '\x1b[1;92m[EMPLOYEE CREATED] Login credentials were printed above in the yellow box.\x1b[0m',
      );
      this.eventEmitter.emit('employee.created', {
        tenantId,
        employeeId: updatedEmployee.id,
        userId: actingUserId,
      });
      return updatedEmployee;
    } catch (err) {
      // Rollback: delete the leave balances, contract, and employee if provisioning fails.
      // tenant-scope-ok: employee.id is the record created earlier in this same
      // function call, scoped to `tenantId` — not attacker-supplied.
      await prisma.leaveBalance.deleteMany({
        where: { employeeId: employee.id },
      });
      await prisma.employmentContract.deleteMany({
        where: { employeeId: employee.id },
      });
      // tenant-scope-ok: same freshly-created record as above.
      await prisma.employee.delete({
        where: { id: employee.id },
      });
      throw err;
    }
  }

  /** Current (open-ended) contract only — cheap enough to include on every list/detail fetch. */
  private static readonly CURRENT_CONTRACT_INCLUDE = {
    contracts: {
      where: { endDate: null },
      orderBy: { startDate: 'desc' as const },
      take: 1,
    },
  };

  async findAll(tenantId: string, scope: 'active' | 'inactive' | 'all' = 'active') {
    if (scope === 'inactive') {
      return prisma.employee.findMany({
        where: {
          tenantId,
          OR: [
            { deletedAt: { not: null } },
            { status: { in: [EmploymentStatus.TERMINATED, EmploymentStatus.SUSPENDED] } },
          ],
        },
        include: { department: true, manager: true, ...EmployeeService.CURRENT_CONTRACT_INCLUDE },
        orderBy: { fullName: 'asc' },
      });
    }

    if (scope === 'all') {
      return prisma.employee.findMany({
        where: { tenantId },
        include: { department: true, manager: true, ...EmployeeService.CURRENT_CONTRACT_INCLUDE },
        orderBy: { fullName: 'asc' },
      });
    }

    return prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.SUSPENDED] },
      },
      include: { department: true, manager: true, ...EmployeeService.CURRENT_CONTRACT_INCLUDE },
      orderBy: { fullName: 'asc' },
    });
  }

  async findMe(tenantId: string, userId: string) {
    let employee = await prisma.employee.findFirst({
      where: { tenantId, userId, deletedAt: null },
      include: { department: true, manager: true },
    });

    if (!employee) {
      const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
      });
      if (user?.email) {
        employee = await prisma.employee.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            email: { equals: user.email, mode: 'insensitive' },
          },
          include: { department: true, manager: true },
        });
        if (employee && !employee.userId) {
          // tenant-scope-ok: `employee` was just fetched a few lines above via a
          // tenant-scoped findFirst — its id is already verified to belong to tenantId.
          employee = await prisma.employee.update({
            where: { id: employee.id },
            data: { userId },
            include: { department: true, manager: true },
          });
        }
      }
    }

    if (!employee) throw new NotFoundException('Employee profile not found');
    return employee;
  }

  async findOne(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        department: true,
        manager: true,
        directReports: true,
        ...EmployeeService.CURRENT_CONTRACT_INCLUDE,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(
    tenantId: string,
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
    actingUserId?: string,
  ) {
    const existing = await this.findOne(tenantId, id); // Ensure it exists in this tenant

    const {
      systemRole,
      provideErpAccess,
      allowedModules,
      salary,
      currencyCode,
      ...employeeFields
    } = updateEmployeeDto;
    const data: any = { ...employeeFields };
    if (data.hireDate) data.hireDate = new Date(data.hireDate);
    if (allowedModules !== undefined) {
      data.allowedModules = filterAssignableModules(allowedModules);
    }
    if (data.firstName && data.lastName) {
      data.fullName = data.firstName + ' ' + data.lastName;
      delete data.firstName;
      delete data.lastName;
    }

    // tenant-scope-ok: findOne() above already throws NotFoundException unless `id`
    // belongs to `tenantId`, so this update-by-id is verified safe.
    const updated = await prisma.employee.update({
      where: { id },
      data,
    });

    if (updateEmployeeDto.systemRole && updated.userId) {
      await this.tenantService.assignUserRole(
        tenantId,
        updated.userId,
        updateEmployeeDto.systemRole,
      );
    }

    // Salary lives on EmploymentContract, not Employee — payroll only reads from
    // there. A revision closes the current contract and opens a new one, keeping
    // a full history instead of mutating past pay periods.
    if (salary !== undefined && salary !== null) {
      const jobTitle = updateEmployeeDto.designation || existing.designation || 'Employee';
      const currentContract = await prisma.employmentContract.findFirst({
        where: { employeeId: id, endDate: null },
        orderBy: { startDate: 'desc' },
      });

      const salaryChanged =
        !currentContract ||
        Number(currentContract.salary) !== Number(salary) ||
        currentContract.jobTitle !== jobTitle;

      if (salaryChanged) {
        const effectiveDate = new Date();
        if (currentContract) {
          await prisma.employmentContract.update({
            where: { id: currentContract.id },
            data: { endDate: effectiveDate },
          });
        }
        await prisma.employmentContract.create({
          data: {
            tenantId,
            employeeId: id,
            jobTitle,
            salary,
            currencyCode: currencyCode || currentContract?.currencyCode || 'INR',
            startDate: currentContract ? effectiveDate : new Date(updated.hireDate),
          },
        });
      }
    }

    this.eventEmitter.emit('employee.updated', { tenantId, employeeId: id, userId: actingUserId });
    return updated;
  }

  async remove(tenantId: string, id: string, actingUserId?: string) {
    await this.findOne(tenantId, id);
    // tenant-scope-ok: findOne() above already throws NotFoundException unless `id`
    // belongs to `tenantId`, so this update-by-id is verified safe.
    const result = await prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'TERMINATED',
      },
    });
    this.eventEmitter.emit('employee.deleted', { tenantId, employeeId: id, userId: actingUserId });
    return result;
  }

  async restore(tenantId: string, id: string, actingUserId?: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const restored = await prisma.employee.update({
      where: { id },
      data: {
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: { department: true, manager: true },
    });
    this.eventEmitter.emit('employee.updated', { tenantId, employeeId: id, userId: actingUserId });
    return restored;
  }
}
