import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';

@ApiTags('Project Management - Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('pm/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) { }

  @Post()
  createProject(@Req() req: any, @Body() dto: CreateProjectDto) {
    const tenantId = req.tenantId || 'default-tenant-id';
    return this.projectService.createProject(tenantId, dto);
  }

  @Post('tasks')
  createTask(@Req() req: any, @Body() dto: CreateTaskDto) {
    const tenantId = req.tenantId || 'default-tenant-id';
    return this.projectService.createTask(tenantId, dto);
  }
}
