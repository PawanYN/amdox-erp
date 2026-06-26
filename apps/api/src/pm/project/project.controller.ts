import { Controller, Post, Body, Req } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateTaskDto } from '../dto/create-task.dto';

@Controller('pm/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

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
