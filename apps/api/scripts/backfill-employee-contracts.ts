import 'dotenv/config';
import { PrismaClient } from '@amdox/db';

/**
 * One-off backfill: create an EmploymentContract for every company-a employee
 * that doesn't have one yet.
 *
 * WHY: The payroll processor (`payroll.processor.ts`) only pays employees who
 * have an active `EmploymentContract` — nothing created that record until
 * salary capture was added to employee create/update. All 21 pre-existing
 * employees have zero contracts, so every payroll run silently skips them.
 *
 * Salary is inferred from designation (rough seniority tiers, INR/month) since
 * historical data was never captured. Adjust real figures later via the
 * employee edit form — this just unblocks payroll end-to-end.
 *
 * Idempotent: skips any employee that already has an EmploymentContract.
 */
const prisma = new PrismaClient();

const SALARY_RULES: { pattern: RegExp; monthly: number }[] = [
  { pattern: /manager|administrator/i, monthly: 120000 },
  { pattern: /tech lead|^lead/i, monthly: 110000 },
  { pattern: /senior/i, monthly: 95000 },
  { pattern: /junior/i, monthly: 55000 },
  { pattern: /developer|engineer/i, monthly: 75000 },
];
const DEFAULT_MONTHLY_SALARY = 48000;

function inferSalary(designation: string): number {
  const rule = SALARY_RULES.find((r) => r.pattern.test(designation));
  return rule ? rule.monthly : DEFAULT_MONTHLY_SALARY;
}

async function backfill() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'company-a' } });
  if (!tenant) throw new Error('Tenant company-a not found.');

  const employees = await prisma.employee.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { contracts: { take: 1 } },
    orderBy: { fullName: 'asc' },
  });

  console.log(`Found ${employees.length} employee(s) in company-a.`);

  let created = 0;
  let skipped = 0;

  for (const employee of employees) {
    if (employee.contracts.length > 0) {
      skipped++;
      continue;
    }

    const jobTitle = employee.designation || 'Employee';
    const salary = inferSalary(jobTitle);

    await prisma.employmentContract.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee.id,
        jobTitle,
        salary,
        currencyCode: 'INR',
        startDate: employee.hireDate,
      },
    });

    console.log(
      `  + ${employee.fullName.padEnd(20)} ${jobTitle.padEnd(28)} ₹${salary.toLocaleString('en-IN')}/mo`,
    );
    created++;
  }

  console.log(`\nDone. Created ${created} contract(s), skipped ${skipped} (already had one).`);
  if (created > 0) {
    console.log('Payroll runs will now include these employees.');
  }
}

backfill()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
