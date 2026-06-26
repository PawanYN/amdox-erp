import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { AllocateResourceDto } from '../dto/allocate-resource.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ResourceService {
  private prisma = new PrismaClient();

  constructor(private eventEmitter: EventEmitter2) {}

  async allocateResource(tenantId: string, dto: AllocateResourceDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId, tenantId }
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
        endDate: dto.endDate ? new Date(dto.endDate) : null
      }
    });

    this.eventEmitter.emit('resources.assigned', { allocationId: allocation.id, tenantId });
    this.eventEmitter.emit('project.resource_needed', { employeeId: employee.id, projectId: dto.projectId, tenantId });

    return allocation;
  }

  async getUtilisationHeatmap(tenantId: string, employeeId: string) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: { tenantId, employeeId }
    });

    const totalHours = allocations.reduce((sum, alloc) => sum + Number(alloc.allocatedHours), 0);
    
    return {
      employeeId,
      totalAllocatedHours: totalHours,
      isOverAllocated: totalHours > 40
    };
  }
}
