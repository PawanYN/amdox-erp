import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ProjectService } from './project.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { MaterialRequestDto } from '../dto/material-request.dto';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { UpdateMilestoneDto } from '../dto/update-milestone.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';

@ApiTags('Project Management - Projects')
@ApiBearerAuth()
@RequireModule('projects')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('pm/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.tenantId || 'default-tenant-id';
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  @ApiOperation({ summary: 'List all projects with budget summary' })
  listProjects(@Req() req: any) {
    return this.projectService.listProjects(this.tenantId(req));
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('material-products')
  @ApiOperation({
    summary: 'List SCM products available for project material requests (read-only)',
  })
  listMaterialProducts(@Req() req: any) {
    return this.projectService.listMaterialProducts(this.tenantId(req));
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('material-requests')
  @ApiOperation({ summary: 'List SCM items requested/provided for projects (read-only)' })
  listMaterialRequests(@Req() req: any) {
    return this.projectService.listMaterialRequests(this.tenantId(req));
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('tasks')
  @ApiOperation({ summary: 'List tasks (optional project filter)' })
  listTasks(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.projectService.listTasks(this.tenantId(req), projectId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch('tasks/:taskId')
  @ApiOperation({ summary: 'Update task status and/or reschedule dates' })
  updateTask(@Req() req: any, @Param('taskId') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.projectService.updateTask(this.tenantId(req), taskId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Delete('tasks/:taskId')
  @ApiOperation({ summary: 'Delete a task and its dependencies/allocations' })
  deleteTask(@Req() req: any, @Param('taskId') taskId: string) {
    return this.projectService.deleteTask(this.tenantId(req), taskId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project metadata or status' })
  updateProject(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(this.tenantId(req), projectId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post(':projectId/close')
  @ApiOperation({ summary: 'Mark project as completed (close without deleting data)' })
  closeProject(@Req() req: any, @Param('projectId') projectId: string) {
    return this.projectService.closeProject(this.tenantId(req), projectId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Delete(':projectId')
  @ApiOperation({
    summary: 'Delete project and all milestones, tasks, budgets, and resource allocations',
  })
  deleteProject(@Req() req: any, @Param('projectId') projectId: string) {
    return this.projectService.deleteProject(this.tenantId(req), projectId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Delete(':projectId/milestones/:milestoneId')
  @ApiOperation({ summary: 'Delete a milestone (tasks are kept, unlinked)' })
  deleteMilestone(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.projectService.deleteMilestone(this.tenantId(req), projectId, milestoneId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':projectId')
  @ApiOperation({ summary: 'Get project detail with budget, milestones, tasks, team' })
  getProject(@Req() req: any, @Param('projectId') projectId: string) {
    return this.projectService.getProject(this.tenantId(req), projectId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':projectId/milestones')
  @ApiOperation({ summary: 'List milestones with overdue alerts' })
  listMilestones(@Req() req: any, @Param('projectId') projectId: string) {
    return this.projectService.listMilestones(this.tenantId(req), projectId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post(':projectId/milestones')
  @ApiOperation({ summary: 'Create a project milestone' })
  createMilestone(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projectService.createMilestone(this.tenantId(req), projectId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':projectId/milestones/:milestoneId')
  @ApiOperation({ summary: 'Update milestone name or due date' })
  updateMilestone(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projectService.updateMilestone(this.tenantId(req), projectId, milestoneId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':projectId/milestones/:milestoneId/achieve')
  @ApiOperation({ summary: 'Mark milestone as achieved' })
  achieveMilestone(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.projectService.achieveMilestone(this.tenantId(req), projectId, milestoneId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post(':projectId/material-requests')
  @ApiOperation({ summary: 'Request materials from SCM for a project' })
  requestMaterial(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: MaterialRequestDto,
  ) {
    return this.projectService.requestMaterial(this.tenantId(req), projectId, dto, req.user?.sub);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  createProject(@Req() req: any, @Body() dto: CreateProjectDto) {
    return this.projectService.createProject(
      this.tenantId(req),
      dto,
      req.user?.id ?? req.user?.sub,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('tasks')
  createTask(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.projectService.createTask(this.tenantId(req), dto);
  }
}
