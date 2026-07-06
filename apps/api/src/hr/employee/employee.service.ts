import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { TenantService } from '../../tenant/tenant.service';

@Injectable()
export class EmployeeService {
  private prisma = new PrismaClient();

  constructor(
    private readonly tenantService: TenantService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, createEmployeeDto: CreateEmployeeDto, actingUserId?: string) {
    // Prisma requires strict Date objects, so we safely convert the string from the DTO
    const employee = await this.prisma.employee.create({
      data: {
        fullName: createEmployeeDto.firstName + ' ' + createEmployeeDto.lastName,
        email: createEmployeeDto.email,
        hireDate: new Date(createEmployeeDto.hireDate),
        tenantId,
        departmentId: createEmployeeDto.departmentId,
        managerId: createEmployeeDto.managerId,
      },
    });
    console.log(
      `\x1b[32m[PRISMA EMPLOYEE CREATED] Inserted Employee ID: ${employee.id} (${employee.fullName})\x1b[0m`,
    );

    const defaultLeaveTypes = await this.prisma.leaveType.findMany({
      where: { tenantId },
    });

    if (defaultLeaveTypes.length > 0) {
      const result = await this.prisma.leaveBalance.createMany({
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

    try {
      const userId = await this.tenantService.provisionEmployeeUser(
        tenantId,
        createEmployeeDto.email,
        createEmployeeDto.firstName + ' ' + createEmployeeDto.lastName,
      );

      // tenant-scope-ok: employee.id is the record we just created above in this
      // same function call, scoped to `tenantId` — not attacker-supplied.
      const updatedEmployee = await this.prisma.employee.update({
        where: { id: employee.id },
        data: { userId },
      });
      console.log(
        `\x1b[38;2;99;102;241m[EMPLOYEE CREATED] ${JSON.stringify(updatedEmployee, null, 2)}\x1b[0m`,
      );
      this.eventEmitter.emit('employee.created', {
        tenantId,
        employeeId: updatedEmployee.id,
        userId: actingUserId,
      });
      return updatedEmployee;
    } catch (err) {
      // Rollback: delete the leave balances and employee if provisioning fails.
      // tenant-scope-ok: employee.id is the record created earlier in this same
      // function call, scoped to `tenantId` — not attacker-supplied.
      await this.prisma.leaveBalance.deleteMany({
        where: { employeeId: employee.id },
      });
      // tenant-scope-ok: same freshly-created record as above.
      await this.prisma.employee.delete({
        where: { id: employee.id },
      });
      throw err;
    }
  }

  async findAll(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      include: { department: true, manager: true },
    });
  }

  async findMe(tenantId: string, userId: string) {
    let employee = await this.prisma.employee.findFirst({
      where: { tenantId, userId, deletedAt: null },
      include: { department: true, manager: true },
    });

    if (!employee) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, tenantId },
      });
      if (user?.email) {
        employee = await this.prisma.employee.findFirst({
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
          employee = await this.prisma.employee.update({
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
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: { department: true, manager: true, directReports: true },
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
    await this.findOne(tenantId, id); // Ensure it exists in this tenant

    const data: any = { ...updateEmployeeDto };
    if (data.hireDate) data.hireDate = new Date(data.hireDate);
    if (data.firstName && data.lastName) {
      data.fullName = data.firstName + ' ' + data.lastName;
      delete data.firstName;
      delete data.lastName;
    }

    // tenant-scope-ok: findOne() above already throws NotFoundException unless `id`
    // belongs to `tenantId`, so this update-by-id is verified safe.
    const updated = await this.prisma.employee.update({
      where: { id },
      data,
    });
    this.eventEmitter.emit('employee.updated', { tenantId, employeeId: id, userId: actingUserId });
    return updated;
  }

  async remove(tenantId: string, id: string, actingUserId?: string) {
    await this.findOne(tenantId, id);
    // tenant-scope-ok: findOne() above already throws NotFoundException unless `id`
    // belongs to `tenantId`, so this update-by-id is verified safe.
    const result = await this.prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'TERMINATED',
      },
    });
    this.eventEmitter.emit('employee.deleted', { tenantId, employeeId: id, userId: actingUserId });
    return result;
  }
}
