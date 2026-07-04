import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AmdoxLogger } from '../../common/logger/amdox-logger';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.userRoles) {
      AmdoxLogger.warn('RolesGuard denied — missing user or userRoles', `required=[${requiredRoles.join(', ')}]`);
      return false;
    }

    const userRoleNames = user.userRoles.map((ur: any) => ur.role.name.replace(/\s+/g, ''));
    const hasRole = requiredRoles.some((role) => userRoleNames.includes(role));

    if (!hasRole) {
      AmdoxLogger.warn(
        `Access denied  ${user.email ?? 'unknown'}`,
        `has=[${userRoleNames.join(', ')}]  required=[${requiredRoles.join(', ')}]`,
      );
    }

    return hasRole;
  }
}
