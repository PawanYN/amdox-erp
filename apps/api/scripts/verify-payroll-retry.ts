/**
 * A3 verification: prove a BullMQ retry of a payroll run no longer duplicates payslips.
 *
 * Simulates the exact crash scenario: attempt #1 wrote payslips for every employee
 * but died before marking the run COMPLETED. The retry (attempt #2) re-enters the
 * processor from employee 0. Before the fix, every employee ended up with TWO
 * payslips; with the compensation step, stale rows are wiped first.
 */
import { prisma } from '@amdox/db';
import { Queue } from 'bullmq';

const STALE_MARKER = 999.0001; // recognizable netPay for attempt-#1 rows

async function main() {
  const anyEmployee = await prisma.employee.findFirst({
    where: { status: 'ACTIVE' },
    select: { tenantId: true },
  });
  if (!anyEmployee) throw new Error('no active employees in any tenant');
  const tenantId = anyEmployee.tenantId;

  const employees = await prisma.employee.findMany({
    where: { tenantId, status: 'ACTIVE', contracts: { some: {} } },
    select: { id: true },
  });
  console.log(`eligible employees: ${employees.length}`);

  // 1. Create the run exactly like enqueuePayrollRun does
  const run = await prisma.payrollRun.create({
    data: { tenantId, periodLabel: 'RETRY-TEST', status: 'PROCESSING', startedAt: new Date() },
  });

  // 2. Simulate attempt #1's leftovers
  await prisma.payslip.createMany({
    data: employees.map((e) => ({
      tenantId,
      payrollRunId: run.id,
      employeeId: e.id,
      grossPay: 1000,
      deductions: 1,
      netPay: STALE_MARKER,
    })),
  });
  console.log(`pre-inserted ${employees.length} stale payslips (simulated crashed attempt #1)`);

  // 3. Enqueue the real job — the running API worker processes it (attempt #2)
  const queue = new Queue('payroll', {
    connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 },
  });
  const now = new Date();
  await queue.add('run', {
    payrollRunId: run.id,
    tenantId,
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    label: 'RETRY-TEST',
  });

  // 4. Wait for completion
  let status = 'PROCESSING';
  for (let i = 0; i < 45 && status === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const row = await prisma.payrollRun.findUnique({ where: { id: run.id } });
    status = row?.status ?? 'MISSING';
  }
  console.log(`run status: ${status}`);

  // 5. Assertions
  const slips = await prisma.payslip.findMany({ where: { payrollRunId: run.id } });
  const byEmployee = new Map<string, number>();
  for (const s of slips) byEmployee.set(s.employeeId, (byEmployee.get(s.employeeId) ?? 0) + 1);
  const duplicated = [...byEmployee.values()].filter((c) => c > 1).length;
  const staleLeft = slips.filter((s) => Number(s.netPay) === STALE_MARKER).length;
  const slipSum = slips.reduce((sum, s) => sum + Number(s.netPay), 0);
  const runRow = await prisma.payrollRun.findUnique({ where: { id: run.id } });
  const totalNetPay = Number(runRow?.totalNetPay ?? 0);

  console.log(`payslips: ${slips.length} (expected ${employees.length})`);
  console.log(`employees with >1 payslip: ${duplicated} (expected 0)`);
  console.log(`stale attempt-#1 rows remaining: ${staleLeft} (expected 0)`);
  console.log(`run.totalNetPay=${totalNetPay.toFixed(4)} vs sum(payslips)=${slipSum.toFixed(4)}`);

  const pass =
    status === 'COMPLETED' &&
    slips.length === employees.length &&
    duplicated === 0 &&
    staleLeft === 0 &&
    Math.abs(totalNetPay - slipSum) < 0.01;
  console.log(pass ? '✅ PASS — retry is idempotent' : '❌ FAIL');

  // 6. Cleanup test data
  await prisma.payslip.deleteMany({ where: { payrollRunId: run.id } });
  await prisma.payrollRun.delete({ where: { id: run.id } });
  await queue.close();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
