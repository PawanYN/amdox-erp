import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';

@ApiTags('Project Management - Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('pm/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.tenantId || 'default-tenant-id';
  }

  @Get()
  @ApiOperation({ summary: 'List all projects with budget summary' })
  listProjects(@Req() req: any) {
    return this.projectService.listProjects(this.tenantId(req));
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List tasks (optional project filter)' })
  listTasks(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.projectService.listTasks(this.tenantId(req), projectId);
  }

  @Get(':projectId/milestones')
  @ApiOperation({ summary: 'List milestones with overdue alerts' })
  listMilestones(@Req() req: any, @Param('projectId') projectId: string) {
    return this.projectService.listMilestones(this.tenantId(req), projectId);
  }

  @Post()
  createProject(@Req() req: any, @Body() dto: CreateProjectDto) {
    return this.projectService.createProject(this.tenantId(req), dto);
  }

  @Post('tasks')
  createTask(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.projectService.createTask(this.tenantId(req), dto);
  }
}
