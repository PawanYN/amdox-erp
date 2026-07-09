/**
 * Two checks, both existing to prevent the same class of bug (one tenant's data
 * leaking to another) from creeping back in:
 *
 * 1. `new PrismaClient()` ban. Every apps/api/src service used to construct its own
 *    raw, unscoped PrismaClient instead of importing the auto-scoping `prisma` export
 *    from @amdox/db (which reads the current request's tenantId from AsyncLocalStorage
 *    and injects it into every query automatically). All 38 were migrated on
 *    2026-07-07 — this check keeps it that way. The only legitimate raw
 *    `new PrismaClient()` call is inside packages/db/src/client.ts itself (a
 *    different package, not scanned here), which is what builds the safe export.
 *
 * 2. Missing-tenantId scan. Even with the safe export, defense-in-depth means every
 *    individual query should still filter by tenantId explicitly rather than relying
 *    solely on the ambient auto-injection — background jobs (BullMQ processors,
 *    @Cron schedulers, @OnEvent listeners) run outside the HTTP request pipeline, so
 *    the auto-injection's AsyncLocalStorage context is never set for them, and the
 *    explicit filter is the *only* protection there. This scans for
 *    findMany/findFirst/findUnique/update/updateMany/delete/deleteMany/count/upsert/
 *    create/createMany calls whose where/data looks like it's missing tenantId.
 *
 * Both are static, best-effort scans, not proofs. To keep false positives low, the
 * missing-tenantId scan treats anything it can't fully verify (a spread `...x`, a
 * variable holding the where/data object, a `tx.model.op()` call inside a
 * `$transaction`) as "assume safe" rather than flagging it — so a clean run does not
 * guarantee correctness, but a flagged line is always worth a look.
 *
 * Usage:  pnpm audit:tenant-scoping        (from apps/api)
 * Exit code 0 = clean, 1 = findings (wired into CI so it blocks the build).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const SRC_ROOT = path.join(__dirname, '..', 'src');

// Prisma model property names (camelCase, as used on the client — e.g. model
// `RolePermission` -> `prisma.rolePermission`) that genuinely have no tenantId
// column in the schema, so queries against them are legitimately exempt.
// Keep this in sync with `packages/db/prisma/schema.prisma`.
const BYPASS_MODELS = new Set([
  'tenant',
  'rolePermission'.toLowerCase(),
  'sagaState'.toLowerCase(),
]);

const SCOPED_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findUnique',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'upsert',
]);
const CREATE_OPERATIONS = new Set(['create', 'createMany']);

interface Finding {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function usesRawPrismaClient(sourceText: string): boolean {
  return /new\s+PrismaClient\s*\(/.test(sourceText);
}

// Matches a direct `tenantId` key, or a Prisma compound-unique-key property like
// `tenantId_name` / `code_tenantId` (Prisma names these `field1_field2_..._` joined
// by underscore in @@unique([...]) declaration order — tenantId can appear anywhere
// in that join, not just first).
const TENANT_KEY_PATTERN = /(^|_)tenantId(_|$)/;

function objectHasKey(obj: ts.ObjectLiteralExpression, key: string): boolean {
  return obj.properties.some((p) => {
    if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
      if (!ts.isIdentifier(p.name)) return false;
      return key === 'tenantId' ? TENANT_KEY_PATTERN.test(p.name.text) : p.name.text === key;
    }
    return false;
  });
}

function objectHasSpread(obj: ts.ObjectLiteralExpression): boolean {
  return obj.properties.some((p) => ts.isSpreadAssignment(p));
}

/** True if this expression is either verifiably scoped, or unverifiable (so we don't flag it). */
function isSafeFilterExpression(node: ts.Expression | undefined): boolean {
  if (!node) return false;
  if (ts.isObjectLiteralExpression(node)) {
    return objectHasKey(node, 'tenantId') || objectHasSpread(node);
  }
  // A variable, function call, ternary, etc. — can't verify statically, don't flag.
  return true;
}

function getObjectProperty(
  obj: ts.ObjectLiteralExpression | undefined,
  key: string,
): ts.Expression | undefined {
  if (!obj) return undefined;
  const prop = obj.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key,
  );
  return prop?.initializer;
}

/** Matches `prisma.<model>.<op>(...)`, `this.prisma.<model>.<op>(...)`, or `tx.<model>.<op>(...)`. */
function matchPrismaCall(callee: ts.Expression): { model: string; operation: string } | null {
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const operation = callee.name.text;

  const modelAccess = callee.expression;
  if (!ts.isPropertyAccessExpression(modelAccess)) return null;
  const model = modelAccess.name.text;
  const base = modelAccess.expression;

  const baseIsPrismaClient =
    (ts.isPropertyAccessExpression(base) && base.name.text === 'prisma') ||
    (ts.isIdentifier(base) && (base.text === 'prisma' || base.text === 'tx'));

  if (!baseIsPrismaClient) return null;
  return { model, operation };
}

function makeFinding(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  reason: string,
): Finding {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const text = node.getText(sourceFile).split('\n')[0].trim();
  return {
    file: path.relative(process.cwd(), filePath),
    line: line + 1,
    snippet: text.length > 100 ? text.slice(0, 100) + '…' : text,
    reason,
  };
}

/** A `// tenant-scope-ok: <reason>` comment on the line before a call suppresses it —
 * for the rare legitimate case (e.g. looking a user up by their globally-unique SSO
 * subject *in order to find out* which tenant they belong to). Keep these rare and
 * always with a reason; they're grepped for in code review.
 *
 * Comments attach as leading trivia to the nearest enclosing *statement*, not to an
 * expression node buried inside it (e.g. the CallExpression in
 * `const x = await foo.bar(...)` starts partway through the statement, well after
 * where the comment's text actually sits) — so we walk up to the statement first. */
function hasSuppressionComment(sourceFile: ts.SourceFile, node: ts.Node): boolean {
  let current: ts.Node = node;
  while (current.parent && !ts.isSourceFile(current.parent)) {
    if (ts.isStatement(current)) break;
    current = current.parent;
  }
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, current.getFullStart()) || [];
  return ranges.some((r) => /tenant-scope-ok:/.test(sourceFile.text.slice(r.pos, r.end)));
}

function auditFile(filePath: string): Finding[] {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  if (!usesRawPrismaClient(sourceText)) return [];

  const findings: Finding[] = [];
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const match = matchPrismaCall(node.expression);
      if (
        match &&
        !BYPASS_MODELS.has(match.model.toLowerCase()) &&
        !hasSuppressionComment(sourceFile, node)
      ) {
        const arg = node.arguments[0];
        const argObj = arg && ts.isObjectLiteralExpression(arg) ? arg : undefined;

        if (SCOPED_OPERATIONS.has(match.operation)) {
          const whereValue = getObjectProperty(argObj, 'where');
          if (!argObj || !isSafeFilterExpression(whereValue)) {
            findings.push(
              makeFinding(
                filePath,
                sourceFile,
                node,
                `${match.model}.${match.operation}() missing tenantId in 'where'`,
              ),
            );
          }
        } else if (CREATE_OPERATIONS.has(match.operation)) {
          const dataValue = getObjectProperty(argObj, 'data');
          let safe = false;
          if (dataValue) {
            if (ts.isArrayLiteralExpression(dataValue)) {
              // createMany: data is an array — every element must be safe.
              safe = dataValue.elements.every((el) => isSafeFilterExpression(el as ts.Expression));
            } else {
              safe = isSafeFilterExpression(dataValue);
            }
          }
          if (!argObj || !dataValue || !safe) {
            findings.push(
              makeFinding(
                filePath,
                sourceFile,
                node,
                `${match.model}.${match.operation}() missing tenantId in 'data'`,
              ),
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function findRawPrismaClientUsage(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((lineText, i) => {
      if (/new\s+PrismaClient\s*\(/.test(lineText)) {
        findings.push({
          file: path.relative(process.cwd(), file),
          line: i + 1,
          snippet: lineText.trim(),
          reason:
            "new PrismaClient() bypasses tenant auto-scoping — import { prisma } from '@amdox/db' instead",
        });
      }
    });
  }
  return findings;
}

function main() {
  const files = walk(SRC_ROOT);

  const rawClientFindings = findRawPrismaClientUsage(files);
  const scopingFindings = files.flatMap(auditFile);
  const allFindings = [...rawClientFindings, ...scopingFindings];

  if (allFindings.length === 0) {
    console.log(
      'tenant-scoping audit: clean — no raw PrismaClient usage or missing tenantId filters found.',
    );
    process.exit(0);
  }

  console.error(
    `tenant-scoping audit: ${allFindings.length} issue${allFindings.length === 1 ? '' : 's'} found:\n`,
  );
  for (const f of allFindings) {
    console.error(`  ${f.file}:${f.line}  ${f.reason}`);
    console.error(`    ${f.snippet}\n`);
  }
  process.exit(1);
}

main();
