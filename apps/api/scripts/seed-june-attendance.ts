import 'dotenv/config';
import { EmploymentStatus, PrismaClient } from '@amdox/db';

/**
 * Seeds June 2026 weekday attendance for all active employees in company-a.
 *
 * WHY: Lets HR/payroll flows be exercised against realistic history — most days
 * present (clock in/out), deliberate absences (no record), and occasional overtime.
 *
 * Idempotent: deletes existing company-a records in 2026-06 before inserting.
 */
const prisma = new PrismaClient();

const YEAR = 2026;
const MONTH = 6; // June (previous month relative to July 2026)

/** Weekday dates in the given month (Mon–Fri, UTC calendar). */
function getWeekdaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  while (cursor.getUTCMonth() === month - 1) {
    const dow = cursor.getUTCDay();
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** 09:00–18:00 IST as UTC; optional +2h for overtime. */
function istShift(
  day: Date,
  options: { overtime?: boolean; late?: boolean } = {},
): { clockIn: Date; clockOut: Date; overtimeMins: number } {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  // 09:00 IST = 03:30 UTC; 17:00 IST = 11:30 UTC (8h, no OT)
  const inMin = options.late ? 45 : 0;
  const clockIn = new Date(Date.UTC(y, m, d, 3, 30 + inMin, 0));
  const clockOut = options.overtime
    ? new Date(Date.UTC(y, m, d, 14, 30, 0)) // 20:00 IST → ~10.5h, ~2.5h OT after late start
    : new Date(Date.UTC(y, m, d, 11, 30, 0)); // 17:00 IST → 8h
  const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  const overtimeMins = hoursWorked > 8 ? Math.round((hoursWorked - 8) * 60) : 0;
  return { clockIn, clockOut, overtimeMins };
}

/** Deterministic absence indices per employee (spread across the month). */
function absenceIndices(employeeIndex: number, weekdayCount: number): Set<number> {
  const count = employeeIndex % 5 === 0 ? 5 : 2 + (employeeIndex % 3); // 2–4, or 5 for every 5th emp
  const indices = new Set<number>();
  for (let a = 0; a < count; a++) {
    indices.add((employeeIndex * 4 + a * 6 + 1) % weekdayCount);
  }
  return indices;
}

async function seed() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'company-a' } });
  if (!tenant) {
    throw new Error('Tenant company-a not found.');
  }

  const employees = await prisma.employee.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: EmploymentStatus.ACTIVE,
    },
    orderBy: { fullName: 'asc' },
  });

  if (employees.length === 0) {
    throw new Error('No active employees found for company-a.');
  }

  const weekdays = getWeekdaysInMonth(YEAR, MONTH);
  const periodStart = new Date(Date.UTC(YEAR, MONTH - 1, 1));
  const periodEnd = new Date(Date.UTC(YEAR, MONTH, 1));

  await prisma.attendanceRecord.deleteMany({
    where: {
      tenantId: tenant.id,
      clockIn: { gte: periodStart, lt: periodEnd },
    },
  });

  const rows: {
    tenantId: string;
    employeeId: string;
    clockIn: Date;
    clockOut: Date;
    overtimeMins: number;
  }[] = [];

  let totalAbsences = 0;

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];
    const absent = absenceIndices(i, weekdays.length);

    for (let d = 0; d < weekdays.length; d++) {
      if (absent.has(d)) {
        totalAbsences++;
        continue;
      }

      const withOvertime = (i + d) % 9 === 0;
      const late = (i + d) % 11 === 0;
      const { clockIn, clockOut, overtimeMins } = istShift(weekdays[d], {
        overtime: withOvertime,
        late,
      });

      rows.push({
        tenantId: tenant.id,
        employeeId: employee.id,
        clockIn,
        clockOut,
        overtimeMins,
      });
    }
  }

  await prisma.attendanceRecord.createMany({ data: rows });

  const overtimeDays = rows.filter((r) => r.overtimeMins > 0).length;
  console.log(`June ${YEAR} attendance seeded for company-a`);
  console.log(`  Employees:        ${employees.length}`);
  console.log(`  Weekdays in month: ${weekdays.length}`);
  console.log(`  Present records:  ${rows.length}`);
  console.log(`  Absence days:     ${totalAbsences} (no record — visible as gaps in attendance)`);
  console.log(`  Overtime days:    ${overtimeDays}`);
  console.log(`\nRun payroll for period "2026-06" to experiment.`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
