import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ProjectService {
  private prisma = new PrismaClient();

  constructor(private eventEmitter: EventEmitter2) {}

  async createProject(tenantId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        tenantId,
        ...dto
      }
    });

    this.eventEmitter.emit('project.created', { projectId: project.id, tenantId });
    return project;
  }

  async createTask(tenantId: string, dto: CreateTaskDto) {
    if (dto.dependsOn && dto.dependsOn.length > 0) {
      const prereqs = await this.prisma.task.findMany({
        where: { id: { in: dto.dependsOn }, projectId: dto.projectId, tenantId }
      });
      if (prereqs.length !== dto.dependsOn.length) {
        throw new BadRequestException('One or more prerequisite tasks are invalid or belong to a different project.');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        tenantId,
        projectId: dto.projectId,
        title: dto.title,
        milestoneId: dto.milestoneId,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        dependsOn: {
          create: dto.dependsOn?.map(id => ({
            tenantId,
            prerequisiteTaskId: id
          })) || []
        }
      }
    });

    this.eventEmitter.emit('tasks.defined', { taskId: task.id, tenantId });
    return task;
  }
}
