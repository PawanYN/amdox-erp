import { Injectable } from '@nestjs/common';
import { prisma } from '@amdox/db';
import {
  ALL_MODULES,
  ErpModule,
  mergeEmployeeModules,
  isExecutiveViewer,
  isTenantWideRole,
} from './erp-modules';

export type UserAccessContext = {
  roles: string[];
  modules: ErpModule[];
  department: { id: string; name: string; code: string } | null;
};

@Injectable()
export class AccessService {
  normalizeRoles(user: { userRoles?: { role: { name: string } }[]; roles?: string[] }): string[] {
    const fromDb = (user?.userRoles ?? []).map((ur) => ur.role.name.replace(/\s+/g, ''));
    const fromJwt = user?.roles ?? [];
    return [...new Set([...fromDb, ...fromJwt])];
  }

  async resolveForUser(user: {
    id: string;
    tenantId: string;
    userRoles?: { role: { name: string } }[];
    roles?: string[];
  }): Promise<UserAccessContext> {
    const roles = this.normalizeRoles(user);

    const employee = await prisma.employee.findFirst({
      where: { tenantId: user.tenantId, userId: user.id, deletedAt: null },
      include: { department: true },
    });

    if (!employee && user.tenantId) {
      const dbUser = await prisma.user.findFirst({
        where: { id: user.id, tenantId: user.tenantId },
      });
      if (dbUser?.email) {
        const byEmail = await prisma.employee.findFirst({
          where: {
            tenantId: user.tenantId,
            deletedAt: null,
            email: { equals: dbUser.email, mode: 'insensitive' },
          },
          include: { department: true },
        });
        if (byEmail) {
          return this.buildContext(roles, byEmail.department, byEmail.allowedModules);
        }
      }
    }

    return this.buildContext(roles, employee?.department ?? null, employee?.allowedModules);
  }

  private buildContext(
    roles: string[],
    department: {
      id: string;
      name: string;
      code: string;
      allowedModules: string[];
    } | null,
    employeeAllowedModules?: string[] | null,
  ): UserAccessContext {
    if (isTenantWideRole(roles)) {
      return {
        roles,
        modules: [...ALL_MODULES],
        department: department
          ? { id: department.id, name: department.name, code: department.code }
          : null,
      };
    }

    if (isExecutiveViewer(roles)) {
      return {
        roles,
        modules: [...ALL_MODULES],
        department: department
          ? { id: department.id, name: department.name, code: department.code }
          : null,
      };
    }

    if (department) {
      return {
        roles,
        modules: mergeEmployeeModules(
          department.code,
          department.allowedModules,
          employeeAllowedModules,
        ),
        department: { id: department.id, name: department.name, code: department.code },
      };
    }

    return {
      roles,
      modules: mergeEmployeeModules('', [], employeeAllowedModules),
      department: null,
    };
  }
}
