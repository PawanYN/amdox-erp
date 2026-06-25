"use client";

import { Employee } from "@/lib/types";

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

function buildTree(employees: Employee[]): TreeNode[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const childrenOf = new Map<string, Employee[]>();

  for (const emp of employees) {
    if (emp.reportsToId && byId.has(emp.reportsToId)) {
      const list = childrenOf.get(emp.reportsToId) ?? [];
      list.push(emp);
      childrenOf.set(emp.reportsToId, list);
    }
  }

  function toNode(emp: Employee): TreeNode {
    const children = (childrenOf.get(emp.id) ?? []).map(toNode);
    return { employee: emp, children };
  }

  // Roots are employees with no manager, or whose manager isn't in the list.
  const roots = employees.filter(
    (e) => !e.reportsToId || !byId.has(e.reportsToId)
  );
  return roots.map(toNode);
}

function NodeBox({ employee }: { employee: Employee }) {
  return (
    <div className="inline-flex flex-col items-center rounded-xl border border-line bg-white px-4 py-3 text-center shadow-card">
      <span className="text-sm font-semibold text-ink">{employee.name}</span>
      <span className="mt-0.5 text-xs text-muted">{employee.designation}</span>
    </div>
  );
}

function Branch({ node }: { node: TreeNode }) {
  const hasChildren = node.children.length > 0;
  return (
    <div className="flex flex-col items-center">
      <NodeBox employee={node.employee} />
      {hasChildren && (
        <>
          <div className="h-6 w-px bg-line" />
          <div className="flex items-start gap-8">
            {node.children.map((child) => (
              <div key={child.employee.id} className="flex flex-col items-center">
                <div className="h-0 w-full border-t border-line" />
                <Branch node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChart({ employees }: { employees: Employee[] }) {
  const tree = buildTree(employees);

  if (tree.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted">
        No reporting hierarchy to display yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto px-8 py-10">
      <div className="flex min-w-max justify-center gap-12">
        {tree.map((root) => (
          <Branch key={root.employee.id} node={root} />
        ))}
      </div>
    </div>
  );
}
