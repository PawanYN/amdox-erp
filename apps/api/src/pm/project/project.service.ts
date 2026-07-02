import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ProjectService {
  private prisma = new PrismaClient();

  constructor(private eventEmitter: EventEmitter2) {}

  async listProjects(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        budgets: { orderBy: { createdAt: 'desc' }, take: 1 },
        tasks: true,
        milestones: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((p) => {
      const budget = p.budgets[0];
      const planned = budget ? Number(budget.plannedAmount) : 0;
      const actual = budget ? Number(budget.actualAmount) : 0;
      const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        taskCount: p.tasks.length,
        milestoneCount: p.milestones.length,
        budgetPlanned: planned,
        budgetActual: actual,
        budgetPct: pct,
        budgetOverrun: planned > 0 && actual > planned * 1.1,
      };
    });
  }

  async listTasks(tenantId: string, projectId?: string) {
    return this.prisma.task.findMany({
      where: {
        tenantId,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        dependsOn: { include: { prerequisiteTask: true } },
        milestone: true,
        project: { select: { name: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async createProject(tenantId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        tenantId,
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    this.eventEmitter.emit('project.created', {
      projectId: project.id,
      tenantId,
    });
    return project;
  }

  private async wouldCreateCycle(
    tenantId: string,
    projectId: string,
    newTaskId: string,
    dependsOn: string[],
  ): Promise<boolean> {
    const projectTasks = await this.prisma.task.findMany({
      where: { tenantId, projectId },
      select: { id: true },
    });
    const taskIds = new Set(projectTasks.map((t) => t.id));

    const deps = await this.prisma.taskDependency.findMany({
      where: { tenantId },
      select: { prerequisiteTaskId: true, dependentTaskId: true },
    });

    const graph = new Map<string, string[]>();
    for (const d of deps) {
      if (!taskIds.has(d.dependentTaskId)) continue;
      const list = graph.get(d.dependentTaskId) ?? [];
      list.push(d.prerequisiteTaskId);
      graph.set(d.dependentTaskId, list);
    }
    graph.set(newTaskId, dependsOn);

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const next of graph.get(node) ?? []) {
        if (dfs(next)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };

    return dfs(newTaskId);
  }

  async createTask(tenantId: string, dto: CreateTaskDto) {
    if (dto.dependsOn && dto.dependsOn.length > 0) {
      const prereqs = await this.prisma.task.findMany({
        where: {
          id: { in: dto.dependsOn },
          projectId: dto.projectId,
          tenantId,
        },
      });
      if (prereqs.length !== dto.dependsOn.length) {
        throw new BadRequestException(
          'One or more prerequisite tasks are invalid or belong to a different project.',
        );
      }
    }

    const tempId = 'new-task';
    if (
      dto.dependsOn?.length &&
      (await this.wouldCreateCycle(
        tenantId,
        dto.projectId,
        tempId,
        dto.dependsOn,
      ))
    ) {
      throw new BadRequestException(
        'Task dependencies would create a cycle (DAG violation).',
      );
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
          create:
            dto.dependsOn?.map((id) => ({
              tenantId,
              prerequisiteTaskId: id,
            })) ?? [],
        },
      },
      include: { dependsOn: true, milestone: true },
    });

    this.eventEmitter.emit('tasks.defined', { taskId: task.id, tenantId });
    return task;
  }

  async listMilestones(tenantId: string, projectId: string) {
    const milestones = await this.prisma.milestone.findMany({
      where: { tenantId, projectId },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    return milestones.map((m) => ({
      ...m,
      isOverdue: m.dueDate < now && !m.isAchieved,
      alert: m.dueDate < now && !m.isAchieved,
    }));
  }
}
