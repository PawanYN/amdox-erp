import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule, SkipModuleCheck } from '../../auth/decorators/require-module.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Employees')
@ApiBearerAuth()
@RequireModule('hr')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  create(@Req() req: any, @Body() createEmployeeDto: CreateEmployeeDto) {
    console.log(
      `\x1b[1;93m[EMPLOYEE POST REQUEST] Received payload: ${JSON.stringify(createEmployeeDto, null, 2)}\x1b[0m`,
    );
    return this.employeeService.create(
      req.user.tenantId,
      createEmployeeDto,
      req.user.id ?? req.user.sub,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  findAll(@Req() req: any, @Query('scope') scope?: 'active' | 'inactive' | 'all') {
    const resolved = scope === 'inactive' || scope === 'all' ? scope : 'active';
    return this.employeeService.findAll(req.user.tenantId, resolved);
  }

  @Roles('Employee', 'SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @SkipModuleCheck()
  @Get('me')
  getMe(@Req() req: any) {
    // req.user is the Prisma User record loaded by KeycloakStrategy
    return this.employeeService.findMe(req.user.tenantId, req.user.id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.employeeService.findOne(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':id/restore')
  restore(@Req() req: any, @Param('id') id: string) {
    return this.employeeService.restore(req.user.tenantId, id, req.user.id ?? req.user.sub);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(
      req.user.tenantId,
      id,
      updateEmployeeDto,
      req.user.id ?? req.user.sub,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.employeeService.remove(req.user.tenantId, id, req.user.id ?? req.user.sub);
  }
}
