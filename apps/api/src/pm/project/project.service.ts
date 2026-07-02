import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { MaterialRequestDto } from '../dto/material-request.dto';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { UpdateMilestoneDto } from '../dto/update-milestone.dto';
import { UpdateTaskStatusDto } from '../dto/update-task-status.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskStatus } from '@amdox/db';

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

    const now = new Date();

    return projects.map((p) => {
      const budget = p.budgets[0];
      const planned = budget ? Number(budget.plannedAmount) : 0;
      const actual = budget ? Number(budget.actualAmount) : 0;
      const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
      const overdueMilestoneCount = p.milestones.filter(
        (m) => !m.isAchieved && m.dueDate < now,
      ).length;
      const achievedMilestoneCount = p.milestones.filter((m) => m.isAchieved).length;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        taskCount: p.tasks.length,
        milestoneCount: p.milestones.length,
        achievedMilestoneCount,
        overdueMilestoneCount,
        budgetPlanned: planned,
        budgetActual: actual,
        budgetPct: pct,
        budgetOverrun: planned > 0 && actual > planned * 1.1,
      };
    });
  }

  async getProject(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null },
      include: {
        budgets: { orderBy: { createdAt: 'desc' }, take: 1 },
        milestones: {
          orderBy: { dueDate: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
        tasks: {
          include: {
            milestone: { select: { id: true, name: true } },
            dependsOn: { include: { prerequisiteTask: { select: { id: true, title: true } } } },
          },
          orderBy: { startDate: 'asc' },
        },
        resourceAllocations: {
          include: {
            employee: { select: { id: true, fullName: true } },
            task: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const now = new Date();
    const budget = project.budgets[0];
    const planned = budget ? Number(budget.plannedAmount) : 0;
    const actual = budget ? Number(budget.actualAmount) : 0;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      budget: budget
        ? {
            id: budget.id,
            plannedAmount: planned,
            actualAmount: actual,
            variancePct: planned > 0 ? Math.round(((actual - planned) / planned) * 100) : 0,
            isOverrun: actual > planned + planned * (Number(budget.overrunThresholdPct) / 100),
          }
        : null,
      milestones: project.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        dueDate: m.dueDate,
        isAchieved: m.isAchieved,
        taskCount: m._count.tasks,
        isOverdue: m.dueDate < now && !m.isAchieved,
      })),
      tasks: project.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        startDate: t.startDate,
        dueDate: t.dueDate,
        milestone: t.milestone,
        dependsOn: t.dependsOn.map((d) => d.prerequisiteTask),
      })),
      resources: project.resourceAllocations.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee.fullName,
        taskTitle: a.task?.title,
        allocatedHours: Number(a.allocatedHours),
        startDate: a.startDate,
        endDate: a.endDate,
      })),
    };
  }

  async updateTaskStatus(
    tenantId: string,
    taskId: string,
    status: TaskStatus,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: {
        milestone: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
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

  async updateProject(tenantId: string, projectId: string, dto: import('../dto/update-project.dto').UpdateProjectDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
      },
    });
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
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    const milestones = await this.prisma.milestone.findMany({
      where: { tenantId, projectId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    return milestones.map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate,
      isAchieved: m.isAchieved,
      createdAt: m.createdAt,
      taskCount: m._count.tasks,
      isOverdue: m.dueDate < now && !m.isAchieved,
      alert: m.dueDate < now && !m.isAchieved,
    }));
  }

  async createMilestone(
    tenantId: string,
    projectId: string,
    dto: CreateMilestoneDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    const milestone = await this.prisma.milestone.create({
      data: {
        tenantId,
        projectId,
        name: dto.name,
        dueDate: new Date(dto.dueDate),
      },
    });

    this.eventEmitter.emit('milestone.created', {
      tenantId,
      projectId,
      milestoneId: milestone.id,
    });

    const now = new Date();
    const formatted = {
      ...milestone,
      taskCount: 0,
      isOverdue: milestone.dueDate < now && !milestone.isAchieved,
      alert: milestone.dueDate < now && !milestone.isAchieved,
    };

    if (formatted.isOverdue) {
      this.eventEmitter.emit('milestone.overdue', {
        tenantId,
        projectId,
        milestoneId: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
      });
    }

    return formatted;
  }

  async updateMilestone(
    tenantId: string,
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ) {
    const existing = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId, tenantId },
    });
    if (!existing) throw new NotFoundException('Milestone not found');

    const milestone = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
      },
    });

    const now = new Date();
    const formatted = {
      ...milestone,
      taskCount: await this.prisma.task.count({
        where: { milestoneId, tenantId },
      }),
      isOverdue: milestone.dueDate < now && !milestone.isAchieved,
      alert: milestone.dueDate < now && !milestone.isAchieved,
    };

    return formatted;
  }

  async achieveMilestone(
    tenantId: string,
    projectId: string,
    milestoneId: string,
  ) {
    const existing = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId, tenantId },
    });
    if (!existing) throw new NotFoundException('Milestone not found');
    if (existing.isAchieved) {
      throw new BadRequestException('Milestone is already achieved.');
    }

    const milestone = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { isAchieved: true },
    });

    this.eventEmitter.emit('milestone.achieved', {
      tenantId,
      projectId,
      milestoneId: milestone.id,
      name: milestone.name,
    });

    return {
      ...milestone,
      taskCount: await this.prisma.task.count({
        where: { milestoneId, tenantId },
      }),
      isOverdue: false,
      alert: false,
    };
  }

  async requestMaterial(
    tenantId: string,
    projectId: string,
    dto: MaterialRequestDto,
    requestedBy?: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.status === 'COMPLETED' || project.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot request materials for a completed or cancelled project.',
      );
    }

    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        id: { in: dto.lines.map((l) => l.productId) },
        isActive: true,
        deletedAt: null,
      },
    });
    if (products.length !== dto.lines.length) {
      throw new BadRequestException(
        'One or more products are invalid or inactive.',
      );
    }

    this.eventEmitter.emit('project.material_requested', {
      tenantId,
      projectId,
      requestedBy,
      reason: dto.reason,
      lines: dto.lines,
    });

    return {
      accepted: true,
      projectId,
      projectName: project.name,
      lineCount: dto.lines.length,
      message: 'Material request submitted to Supply Chain.',
    };
  }
}
