export const PROJECTS = [
  { name: "Warehouse Expansion — Pune", status: "On Track", pct: 62, budget: 480000, spent: 298000, owner: "Karan Joshi" },
  { name: "ERP Phase 2 Rollout", status: "At Risk", pct: 38, budget: 220000, spent: 168000, owner: "Riya Sharma" },
  { name: "Vendor Onboarding — APAC", status: "On Track", pct: 81, budget: 95000, spent: 71000, owner: "Arjun Mehta" },
];

export const TASKS = [
  { name: "Site survey & approvals", start: 0, len: 3, dep: null },
  { name: "Foundation work", start: 3, len: 4, dep: 0 },
  { name: "Steel procurement (SCM)", start: 2, len: 3, dep: null },
  { name: "Structure assembly", start: 7, len: 5, dep: 1 },
  { name: "Electrical & plumbing", start: 9, len: 3, dep: 3 },
  { name: "Final inspection", start: 12, len: 2, dep: 4 },
];

export const PEOPLE = ["Karan Joshi", "Meera Iyer", "Sanjay Patil", "Divya Nair", "Rohit Sen"];
export const WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6"];
export const HEATMAP = [
  [60, 80, 100, 100, 70, 40],
  [40, 50, 60, 90, 110, 100],
  [100, 110, 90, 60, 50, 40],
  [30, 40, 50, 60, 70, 80],
  [80, 90, 100, 110, 95, 60],
];
