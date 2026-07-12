import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ReorderAutomationService } from './reorder.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Automation')
@ApiBearerAuth()
@RequireModule('scm')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('scm/automation')
export class ReorderController {
  constructor(private readonly reorderService: ReorderAutomationService) {}

  @Roles('SuperAdmin', 'TenantAdmin')
  @Post('run-reorder')
  runReorder(@Req() req: any) {
    return this.reorderService.runReorderChecks(req.user.tenantId);
  }
}
