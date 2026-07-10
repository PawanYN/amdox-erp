/** ERP module ids — keep in sync with apps/api/src/auth/erp-modules.ts */

export const ERP_MODULES = [
  "home",
  "bi",
  "forecast",
  "finance",
  "hr",
  "scm",
  "projects",
  "notifications",
  "settings",
] as const;

export type ErpModule = (typeof ERP_MODULES)[number];

export const MODULE_OPTIONS: { id: ErpModule; label: string; description: string }[] = [
  { id: "finance", label: "Finance", description: "GL, AP, AR, sales orders" },
  { id: "hr", label: "Human Resources", description: "Employees, payroll, leave admin" },
  { id: "scm", label: "Supply Chain", description: "Vendors, inventory, purchase orders" },
  { id: "projects", label: "Projects", description: "PM overview, tasks, budget" },
  { id: "bi", label: "BI Reports", description: "Dashboards and analytics" },
  { id: "forecast", label: "AI Forecast", description: "Demand forecasting" },
  { id: "settings", label: "Settings", description: "Tenant configuration and integrations" },
];

export function modulesForDepartment(code: string, allowedModules?: string[] | null): ErpModule[] {
  if (allowedModules?.length) return allowedModules as ErpModule[];
  return defaultModulesForCode(code);
}

export const DEFAULT_DEPARTMENT_MODULES: Record<string, ErpModule[]> = {
  HR: ["hr"],
  FIN: ["finance"],
  FINANCE: ["finance"],
  SCM: ["scm", "forecast"],
  PM: ["projects"],
  PROJECTS: ["projects"],
  IT: ["settings"],
};

export function defaultModulesForCode(code: string): ErpModule[] {
  return DEFAULT_DEPARTMENT_MODULES[code.trim().toUpperCase()] ?? [];
}

/** Map sidebar nav section id → ERP module id */
export function navSectionToModule(sectionId: string): ErpModule | null {
  if (sectionId === "/home") return "home";
  if (sectionId === "/bi") return "bi";
  if (sectionId === "/forecast") return "forecast";
  if (sectionId === "/notifications") return "notifications";
  if (sectionId === "/settings") return "settings";
  if (["finance", "hr", "scm", "projects"].includes(sectionId)) return sectionId as ErpModule;
  return null;
}

export function isModuleAllowed(modules: string[], sectionId: string): boolean {
  const mod = navSectionToModule(sectionId);
  if (!mod) return false;
  return modules.includes(mod);
}
