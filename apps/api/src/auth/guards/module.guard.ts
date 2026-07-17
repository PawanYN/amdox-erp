import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_KEY, SKIP_MODULE_KEY } from '../decorators/require-module.decorator';
import { AccessService } from '../access.service';
import { ErpModule } from '../erp-modules';
import { AmdoxLogger } from '../../infrastructure/common/logger/amdox-logger';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private accessService: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const required = this.reflector.getAllAndOverride<ErpModule[]>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const access = await this.accessService.resolveForUser(user);
    request.userAccess = access;

    const allowed = required.some((mod) => access.modules.includes(mod));
    if (!allowed) {
      AmdoxLogger.warn(
        `Module access denied  ${user.email ?? 'unknown'}`,
        `needs=[${required.join(', ')}]  has=[${access.modules.join(', ')}]`,
      );
      throw new ForbiddenException('Module access denied');
    }

    return true;
  }
}
