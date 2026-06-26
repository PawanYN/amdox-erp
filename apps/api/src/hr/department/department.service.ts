import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

@Injectable()
export class DepartmentService {
  private prisma = new PrismaClient();

  async create(tenantId: string, createDepartmentDto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: {
        ...createDepartmentDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        parent: true,
        children: true,
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async update(tenantId: string, id: string, updateDepartmentDto: UpdateDepartmentDto) {
    await this.findOne(tenantId, id); // Ensure it exists in this tenant
    return this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // Ensure it exists
    return this.prisma.department.delete({
      where: { id },
    });
  }
}
