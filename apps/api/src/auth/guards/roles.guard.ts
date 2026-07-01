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
    
    console.log('[RolesGuard] User Object from token:', user ? 'Exists' : 'Missing', user?.userRoles ? 'Has roles' : 'No roles');
    
    // Safety check: if user or userRoles isn't attached, deny access
    if (!user || !user.userRoles) {
      console.log('[RolesGuard] Denied: Missing user or userRoles array');
      return false;
    }

    // Extract the list of role names the user actually has (normalize by stripping spaces)
    const userRoleNames = user.userRoles.map((ur: any) => ur.role.name.replace(/\s+/g, ''));

    console.log('[RolesGuard] Required Roles:', requiredRoles);
    console.log('[RolesGuard] User Roles (normalized):', userRoleNames);

    // Check if the user has AT LEAST ONE of the required roles
    const hasRole = requiredRoles.some((role) => userRoleNames.includes(role));
    console.log('[RolesGuard] Access Granted?', hasRole);
    return hasRole;
  }
}
