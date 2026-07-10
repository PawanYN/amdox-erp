/** ERP module identifiers — must match web sidebar section ids. */
export const ERP_MODULES = [
  'home',
  'bi',
  'forecast',
  'finance',
  'hr',
  'scm',
  'projects',
  'notifications',
  'settings',
] as const;

export type ErpModule = (typeof ERP_MODULES)[number];

/** Always available to any authenticated user with an employee or user record. */
export const BASE_MODULES: ErpModule[] = ['home', 'notifications'];

/** Modules that can be assigned per employee or department (excludes universal base tabs). */
export const ASSIGNABLE_MODULES: ErpModule[] = [
  'bi',
  'forecast',
  'finance',
  'hr',
  'scm',
  'projects',
  'settings',
];

export const ALL_MODULES: ErpModule[] = [...ERP_MODULES];

/**
 * Default module grants when a department is created without explicit allowedModules.
 * Keys are normalized department codes (uppercase).
 */
export const DEFAULT_DEPARTMENT_MODULES: Record<string, ErpModule[]> = {
  HR: ['hr'],
  FIN: ['finance'],
  FINANCE: ['finance'],
  SCM: ['scm', 'forecast'],
  PM: ['projects'],
  PROJECTS: ['projects'],
  IT: ['settings'],
  ADMIN: ALL_MODULES.filter((m) => m !== 'notifications'),
};

export function normalizeDepartmentCode(code: string): string {
  return code.trim().toUpperCase();
}

export function defaultModulesForDepartmentCode(code: string): ErpModule[] {
  const key = normalizeDepartmentCode(code);
  return DEFAULT_DEPARTMENT_MODULES[key] ?? [];
}

export function mergeDepartmentModules(
  code: string,
  allowedModules?: string[] | null,
): ErpModule[] {
  const deptSpecific =
    allowedModules && allowedModules.length > 0
      ? allowedModules
      : defaultModulesForDepartmentCode(code);
  const merged = new Set<ErpModule>([...BASE_MODULES, ...(deptSpecific as ErpModule[])]);
  return [...merged];
}

export function filterAssignableModules(modules?: string[] | null): ErpModule[] {
  if (!modules?.length) return [];
  const assignable = new Set<string>(ASSIGNABLE_MODULES);
  return modules.filter((m): m is ErpModule => assignable.has(m));
}

/** Resolve effective modules: employee override → department → code defaults. */
export function mergeEmployeeModules(
  departmentCode: string,
  departmentAllowedModules?: string[] | null,
  employeeAllowedModules?: string[] | null,
): ErpModule[] {
  const employeeSpecific = filterAssignableModules(employeeAllowedModules);
  const deptSpecific =
    employeeSpecific.length > 0
      ? employeeSpecific
      : departmentAllowedModules && departmentAllowedModules.length > 0
        ? departmentAllowedModules
        : defaultModulesForDepartmentCode(departmentCode);
  const merged = new Set<ErpModule>([...BASE_MODULES, ...(deptSpecific as ErpModule[])]);
  return [...merged];
}

export function isTenantWideRole(roleNames: string[]): boolean {
  return roleNames.includes('SuperAdmin') || roleNames.includes('TenantAdmin');
}

export function isExecutiveViewer(roleNames: string[]): boolean {
  return roleNames.includes('Viewer');
}
