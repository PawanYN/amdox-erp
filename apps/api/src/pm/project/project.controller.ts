import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProjectService } from './project.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { MaterialRequestDto } from '../dto/material-request.dto';
import { CreateMilestoneDto } from '../dto/create-milestone.dto';
import { UpdateMilestoneDto } from '../dto/update-milestone.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { UpdateTaskStatusDto } from '../dto/update-task-status.dto';

@ApiTags('Project Management - Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
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
  @Get('tasks')
  @ApiOperation({ summary: 'List tasks (optional project filter)' })
  listTasks(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.projectService.listTasks(this.tenantId(req), projectId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch('tasks/:taskId')
  @ApiOperation({ summary: 'Update task status' })
  updateTaskStatus(
    @Req() req: any,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.projectService.updateTaskStatus(
      this.tenantId(req),
      taskId,
      dto.status,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':projectId')
  @ApiOperation({ summary: 'Update project metadata or status' })
  updateProject(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(
      this.tenantId(req),
      projectId,
      dto,
    );
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
    return this.projectService.createMilestone(
      this.tenantId(req),
      projectId,
      dto,
    );
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
    return this.projectService.updateMilestone(
      this.tenantId(req),
      projectId,
      milestoneId,
      dto,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':projectId/milestones/:milestoneId/achieve')
  @ApiOperation({ summary: 'Mark milestone as achieved' })
  achieveMilestone(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.projectService.achieveMilestone(
      this.tenantId(req),
      projectId,
      milestoneId,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post(':projectId/material-requests')
  @ApiOperation({ summary: 'Request materials from SCM for a project' })
  requestMaterial(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: MaterialRequestDto,
  ) {
    return this.projectService.requestMaterial(
      this.tenantId(req),
      projectId,
      dto,
      req.user?.sub,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  createProject(@Req() req: any, @Body() dto: CreateProjectDto) {
    return this.projectService.createProject(this.tenantId(req), dto, req.user?.id ?? req.user?.sub);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('tasks')
  createTask(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.projectService.createTask(this.tenantId(req), dto);
  }
}
