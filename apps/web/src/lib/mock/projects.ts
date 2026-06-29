export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed";

export interface Project {
  id: string;
  name: string;
  description: string;
  managerName: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  budgetPlanned: number;
  budgetActual: number;
  completionPercentage: number;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  assigneeName: string;
  startDate: string;
  endDate: string;
  status: "To Do" | "In Progress" | "Review" | "Done";
  priority: "Low" | "Medium" | "High";
}

export interface ProjectResource {
  id: string;
  projectId: string;
  employeeName: string;
  role: string;
  allocationPercentage: number;
  startDate: string;
  endDate: string;
}

export const mockProjects: Project[] = [
  {
    id: "PRJ-001",
    name: "ERP Implementation",
    description: "Rollout of new AI-Powered Cloud ERP Suite to APAC region.",
    managerName: "Sarah Jenkins",
    startDate: "2026-01-15",
    endDate: "2026-08-30",
    status: "Active",
    budgetPlanned: 450000,
    budgetActual: 215000,
    completionPercentage: 45,
  },
  {
    id: "PRJ-002",
    name: "Warehouse Automation",
    description: "Upgrade robotics and conveyor systems in main distribution center.",
    managerName: "Marcus Chen",
    startDate: "2026-03-01",
    endDate: "2026-12-15",
    status: "Planning",
    budgetPlanned: 1200000,
    budgetActual: 45000,
    completionPercentage: 10,
  },
  {
    id: "PRJ-003",
    name: "Q3 Marketing Campaign",
    description: "Global brand awareness campaign targeting enterprise executives.",
    managerName: "Elena Rodriguez",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    status: "Active",
    budgetPlanned: 250000,
    budgetActual: 110000,
    completionPercentage: 60,
  },
  {
    id: "PRJ-004",
    name: "Data Center Migration",
    description: "Migrate legacy on-prem servers to AWS cloud infrastructure.",
    managerName: "David Kim",
    startDate: "2025-11-01",
    endDate: "2026-04-30",
    status: "Completed",
    budgetPlanned: 320000,
    budgetActual: 315000,
    completionPercentage: 100,
  }
];

export const mockTasks: ProjectTask[] = [
  {
    id: "TSK-001",
    projectId: "PRJ-001",
    title: "Gather Requirements",
    assigneeName: "Alice Smith",
    startDate: "2026-01-15",
    endDate: "2026-02-15",
    status: "Done",
    priority: "High",
  },
  {
    id: "TSK-002",
    projectId: "PRJ-001",
    title: "System Design",
    assigneeName: "Bob Johnson",
    startDate: "2026-02-16",
    endDate: "2026-03-31",
    status: "Done",
    priority: "High",
  },
  {
    id: "TSK-003",
    projectId: "PRJ-001",
    title: "Implementation Phase 1",
    assigneeName: "Charlie Davis",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    status: "In Progress",
    priority: "High",
  },
  {
    id: "TSK-004",
    projectId: "PRJ-001",
    title: "User Training",
    assigneeName: "Diana Evans",
    startDate: "2026-07-01",
    endDate: "2026-08-15",
    status: "To Do",
    priority: "Medium",
  }
];

export const mockResources: ProjectResource[] = [
  {
    id: "RES-001",
    projectId: "PRJ-001",
    employeeName: "Alice Smith",
    role: "Business Analyst",
    allocationPercentage: 100,
    startDate: "2026-01-15",
    endDate: "2026-08-30",
  },
  {
    id: "RES-002",
    projectId: "PRJ-001",
    employeeName: "Bob Johnson",
    role: "System Architect",
    allocationPercentage: 50,
    startDate: "2026-02-01",
    endDate: "2026-05-31",
  },
  {
    id: "RES-003",
    projectId: "PRJ-002",
    employeeName: "Charlie Davis",
    role: "Robotics Engineer",
    allocationPercentage: 80,
    startDate: "2026-03-01",
    endDate: "2026-12-15",
  },
  {
    id: "RES-004",
    projectId: "PRJ-003",
    employeeName: "Elena Rodriguez",
    role: "Marketing Director",
    allocationPercentage: 40,
    startDate: "2026-06-15",
    endDate: "2026-09-30",
  }
];
