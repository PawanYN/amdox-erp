import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

@Injectable()
export class DepartmentService {
  private prisma = new PrismaClient();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async create(tenantId: string, createDepartmentDto: CreateDepartmentDto) {
    const department = await this.prisma.department.create({
      data: {
        ...createDepartmentDto,
        tenantId,
      },
    });
    this.eventEmitter.emit('department.created', { tenantId, departmentId: department.id });
    return department;
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
    // tenant-scope-ok: findOne() above already threw NotFoundException unless `id` belongs to `tenantId`.
    const department = await this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
    });
    this.eventEmitter.emit('department.updated', { tenantId, departmentId: id });
    return department;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // Ensure it exists
    // tenant-scope-ok: findOne() above already threw NotFoundException unless `id` belongs to `tenantId`.
    const department = await this.prisma.department.delete({
      where: { id },
    });
    this.eventEmitter.emit('department.deleted', { tenantId, departmentId: id });
    return department;
  }
}
