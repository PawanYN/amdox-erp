#!/usr/bin/env node
/**
 * Generates the database ERD image from the live Prisma schema.
 *
 * Parses packages/db/prisma/schema.prisma (the single source of truth),
 * groups models into domain clusters, and emits Graphviz DOT rendered to
 * docs/erd/database-erd.png + .svg. Re-run whenever the schema changes:
 *
 *   node scripts/generate-erd.mjs
 *
 * Tenant relations are intentionally omitted from the edge set — every
 * model carries tenantId, so drawing them would bury the real domain
 * relationships. The legend on the image states this.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(root, 'packages/db/prisma/schema.prisma');
const outDir = join(root, 'docs/erd');

const schema = readFileSync(schemaPath, 'utf8');

// ---------- parse models ----------
const modelBlocks = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
const modelNames = new Set(modelBlocks.map((m) => m[1]));

/** @type {Map<string, Map<string, string>>} model -> (referenced model -> FK field name) */
const edges = new Map();
for (const [, name, body] of modelBlocks) {
  const refs = new Map();
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(\w+)\s+(\w+)(\[\])?\??/);
    if (!m) continue;
    const [, field, type, isList] = m;
    if (!modelNames.has(type) || type === name) continue;
    // Only count the FK-holding side (has @relation(fields: ...)) so each
    // relation is drawn once; implicit m:n (list on both sides) drawn from
    // the alphabetically-first model.
    if (/@relation\([^)]*fields:/.test(line)) refs.set(type, field);
    else if (isList && name < type) {
      // check the other side is also a list (implicit m:n)
      const other = modelBlocks.find(([, n]) => n === type)?.[2] ?? '';
      const otherList = new RegExp(`^\\s*\\w+\\s+${name}\\[\\]`, 'm').test(other);
      if (otherList) refs.set(type, field);
    }
  }
  refs.delete('Tenant'); // tenant-scoping edges omitted by design
  edges.set(name, refs);
}

// ---------- domain clusters ----------
const clusters = {
  'Tenancy & Auth': {
    color: '#7C3AED',
    models: [
      'Tenant',
      'User',
      'Role',
      'UserRole',
      'Permission',
      'RolePermission',
      'RefreshToken',
      'ApiKey',
    ],
  },
  Finance: {
    color: '#1A7A3C',
    models: [
      'Account',
      'FiscalPeriod',
      'JournalEntry',
      'JournalLine',
      'Currency',
      'ExchangeRate',
      'IntercompanyTransfer',
      'Customer',
      'SalesOrder',
      'SalesOrderLine',
      'Invoice',
      'InvoiceLine',
      'Payment',
      'PaymentRun',
    ],
  },
  'HR & Payroll': {
    color: '#B3125F',
    models: [
      'Department',
      'Employee',
      'TaxSlab',
      'EmploymentContract',
      'LeaveType',
      'LeaveRequest',
      'LeaveBalance',
      'AttendanceRecord',
      'PayrollRun',
      'Payslip',
    ],
  },
  'Supply Chain & Inventory': {
    color: '#B36B00',
    models: [
      'Vendor',
      'Warehouse',
      'Product',
      'PurchaseRequisition',
      'PurchaseRequisitionLine',
      'PurchaseOrder',
      'PurchaseOrderLine',
      'GoodsReceipt',
      'GoodsReceiptLine',
      'InventoryCostLayer',
      'StockLevel',
      'StockMovement',
      'ReorderRule',
    ],
  },
  'AI Forecasting': { color: '#0E7490', models: ['ForecastModel', 'ForecastPrediction'] },
  'Project Management': {
    color: '#1F6FB2',
    models: [
      'Project',
      'Task',
      'TaskDependency',
      'Milestone',
      'ResourceAllocation',
      'ProjectBudget',
      'ProjectBudgetLine',
    ],
  },
  'Business Intelligence': { color: '#5B21B6', models: ['Dashboard', 'Widget', 'ScheduledReport'] },
  'Notifications & Webhooks': {
    color: '#C2410C',
    models: [
      'Notification',
      'NotificationPreference',
      'NotificationDelivery',
      'WebhookSubscription',
      'WebhookDelivery',
    ],
  },
  'Audit & Compliance': {
    color: '#A93226',
    models: ['AuditLog', 'DataSubjectRequest', 'ConsentRecord'],
  },
  'Eventing & Sagas': { color: '#4B5563', models: ['OutboxEvent', 'SagaState'] },
};

// sanity: every model assigned exactly once
const assigned = new Set(Object.values(clusters).flatMap((c) => c.models));
const unassigned = [...modelNames].filter((m) => !assigned.has(m));
if (unassigned.length) {
  console.error(
    `Models missing a cluster (add them to scripts/generate-erd.mjs): ${unassigned.join(', ')}`,
  );
  process.exit(1);
}
for (const m of assigned) {
  if (!modelNames.has(m)) console.warn(`Cluster references model not in schema (removed?): ${m}`);
}

// ---------- emit DOT ----------
let dot = `digraph ERD {
  graph [rankdir=TB, fontname="Helvetica", fontsize=22, splines=true, ranksep=1.1, nodesep=0.35,
         label="Amdox ERP — Database Model (${modelNames.size} Prisma models, PostgreSQL 17)\\nEvery model carries tenantId (multi-tenant row scoping) — those edges are omitted for readability.\\nGenerated from packages/db/prisma/schema.prisma by scripts/generate-erd.mjs", labelloc=t];
  node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=13, margin="0.14,0.08"];
  edge [color="#8899AA", arrowsize=0.6, penwidth=1.1];
`;

let ci = 0;
for (const [label, { color, models }] of Object.entries(clusters)) {
  dot += `  subgraph cluster_${ci++} {\n`;
  dot += `    label="${label}"; fontsize=17; style="rounded,filled"; fillcolor="${color}14"; color="${color}"; penwidth=2; fontcolor="${color}";\n`;
  for (const m of models) {
    if (!modelNames.has(m)) continue;
    dot += `    ${m} [fillcolor="${color}", fontcolor="white"];\n`;
  }
  dot += '  }\n';
}
for (const [from, refs] of edges) {
  for (const to of refs.keys()) dot += `  ${from} -> ${to};\n`;
}
dot += '}\n';

const dotPath = join(outDir, 'database-erd.dot');
writeFileSync(dotPath, dot);
// fdp packs the domain clusters into a compact ~4:3 canvas (dot's rank-based
// layouts chain them into an extreme strip); fixed seed keeps re-runs stable.
execSync(`fdp -Gstart=42 -Tpng -Gdpi=150 -o "${join(outDir, 'database-erd.png')}" "${dotPath}"`);
execSync(`fdp -Gstart=42 -Tsvg -o "${join(outDir, 'database-erd.svg')}" "${dotPath}"`);
// ---------- emit database-erd.md (mermaid, relationship level) ----------
const modelOf = new Map();
for (const [label, { models }] of Object.entries(clusters))
  for (const m of models) modelOf.set(m, label);

let mermaid = 'erDiagram\n';
for (const [label, { models }] of Object.entries(clusters)) {
  mermaid += `\n    %% ---------- ${label} ----------\n`;
  for (const from of models) {
    const refs = edges.get(from);
    if (!refs) continue;
    for (const [to, field] of refs) mermaid += `    ${to} ||--o{ ${from} : "${field}"\n`;
  }
}

const md = `# Database ERD — Amdox AI-Powered Cloud ERP Suite

> **Generated file — do not edit by hand.** Regenerate after any schema change with
> \`node scripts/generate-erd.mjs\` (source of truth: \`packages/db/prisma/schema.prisma\`).
>
> Current schema: **${modelNames.size} models**, ${[...edges.values()].reduce((n, s) => n + s.size, 0)} relations, PostgreSQL 17 + Prisma.
> Every model carries \`tenantId\` (multi-tenant row scoping); those edges are omitted below for readability.
> \`docs/erd/schema.prisma\` is a synced copy of the live schema for field-level detail.

## Full ERD image

![Database ERD](./database-erd.png)

(\`database-erd.svg\` is the vector version; \`database-erd.dot\` is the Graphviz source.)

## Relationship diagram (mermaid)

Entity-to-entity relations grouped by domain. \`A ||--o{ B : "field"\` reads
“one A has many B, via B’s \`field\` foreign key.” Paste into mermaid.live or view on GitHub.

\`\`\`mermaid
${mermaid}\`\`\`
`;
writeFileSync(join(outDir, 'database-erd.md'), md);

const edgeCount = [...edges.values()].reduce((n, s) => n + s.size, 0);
console.log(
  `ERD generated: ${modelNames.size} models, ${edgeCount} relations -> docs/erd/database-erd.{png,svg,dot,md}`,
);
