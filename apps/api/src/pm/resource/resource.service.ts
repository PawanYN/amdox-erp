import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { AllocateResourceDto } from '../dto/allocate-resource.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ResourceService {
  private prisma = new PrismaClient();

  constructor(private eventEmitter: EventEmitter2) {}

  async listAllocations(tenantId: string) {
    return this.prisma.resourceAllocation.findMany({
      where: { tenantId },
      include: {
        employee: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async allocateResource(tenantId: string, dto: AllocateResourceDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId, tenantId },
    });

    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const allocation = await this.prisma.resourceAllocation.create({
      data: {
        tenantId,
        projectId: dto.projectId,
        taskId: dto.taskId,
        employeeId: dto.employeeId,
        allocatedHours: dto.allocatedHours,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        employee: true,
        project: true,
      },
    });

    this.eventEmitter.emit('resources.assigned', {
      allocationId: allocation.id,
      tenantId,
    });
    return allocation;
  }

  async getUtilisationHeatmap(tenantId: string, employeeId?: string) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: {
        tenantId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: true, project: true },
    });

    const byEmployee = new Map<
      string,
      { name: string; hours: number; projects: Set<string> }
    >();

    for (const a of allocations) {
      const key = a.employeeId;
      const entry = byEmployee.get(key) ?? {
        name: a.employee.fullName,
        hours: 0,
        projects: new Set<string>(),
      };
      entry.hours += Number(a.allocatedHours);
      entry.projects.add(a.project.name);
      byEmployee.set(key, entry);
    }

    return Array.from(byEmployee.entries()).map(([id, v]) => ({
      employeeId: id,
      name: v.name,
      totalAllocatedHours: v.hours,
      projectCount: v.projects.size,
      isOverAllocated: v.hours > 40,
      utilisationPct: Math.min(100, Math.round((v.hours / 40) * 100)),
    }));
  }
}
