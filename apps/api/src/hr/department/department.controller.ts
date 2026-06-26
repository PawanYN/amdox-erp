import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  create(@Req() req: any, @Body() createDepartmentDto: CreateDepartmentDto) {
    // We securely pull the tenantId from the validated JWT token so users can't fake it!
    return this.departmentService.create(req.user.tenantId, createDepartmentDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  findAll(@Req() req: any) {
    return this.departmentService.findAll(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.departmentService.findOne(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    return this.departmentService.update(req.user.tenantId, id, updateDepartmentDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin') // Security: Only top admins can delete!
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.departmentService.remove(req.user.tenantId, id);
  }
}
