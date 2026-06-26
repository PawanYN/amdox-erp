import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  create(@Req() req: any, @Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(req.user.tenantId, createEmployeeDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  findAll(@Req() req: any) {
    return this.employeeService.findAll(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.employeeService.findOne(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(req.user.tenantId, id, updateEmployeeDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.employeeService.remove(req.user.tenantId, id);
  }
}
