import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ReorderAutomationService } from './reorder.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('scm/automation')
export class ReorderController {
  constructor(private readonly reorderService: ReorderAutomationService) {}

  @Roles('SuperAdmin', 'TenantAdmin')
  @Post('run-reorder')
  runReorder(@Req() req: any) {
    return this.reorderService.runReorderChecks(req.user.tenantId);
  }
}
