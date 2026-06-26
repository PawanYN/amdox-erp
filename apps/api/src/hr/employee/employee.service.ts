import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  private prisma = new PrismaClient();

  async create(tenantId: string, createEmployeeDto: CreateEmployeeDto) {
    // Prisma requires strict Date objects, so we safely convert the string from the DTO
    return this.prisma.employee.create({
      data: {
        fullName: createEmployeeDto.firstName + ' ' + createEmployeeDto.lastName,
        email: createEmployeeDto.email,
        hireDate: new Date(createEmployeeDto.hireDate),
        tenantId,
        departmentId: createEmployeeDto.departmentId,
        managerId: createEmployeeDto.managerId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId },
      include: { department: true, manager: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: { department: true, manager: true, directReports: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(tenantId: string, id: string, updateEmployeeDto: UpdateEmployeeDto) {
    await this.findOne(tenantId, id); // Ensure it exists in this tenant
    
    const data: any = { ...updateEmployeeDto };
    if (data.hireDate) data.hireDate = new Date(data.hireDate);
    if (data.firstName && data.lastName) {
      data.fullName = data.firstName + ' ' + data.lastName;
      delete data.firstName;
      delete data.lastName;
    }

    return this.prisma.employee.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.employee.delete({
      where: { id },
    });
  }
}
