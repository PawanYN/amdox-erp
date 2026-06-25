import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // If no roles are required, let them through
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // Safety check: if user or userRoles isn't attached, deny access
    if (!user || !user.userRoles) {
      return false;
    }

    // Extract the list of role names the user actually has
    const userRoleNames = user.userRoles.map((ur: any) => ur.role.name);

    // Check if the user has AT LEAST ONE of the required roles
    return requiredRoles.some((role) => userRoleNames.includes(role));
  }
}
