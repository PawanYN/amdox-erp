import { describe, it, expect } from 'vitest';
import {
  calculatePayrollAmounts,
  resolveTaxSlabRate,
  DEFAULT_STATUTORY,
  ESI_WAGE_CEILING,
} from './payroll-deductions';

describe('calculatePayrollAmounts', () => {
  it('computes gross-to-net with all statutory deductions for a salary under the ESI ceiling', () => {
    const amounts = calculatePayrollAmounts({
      baseSalary: 20000,
      overtimePay: 0,
      statutory: DEFAULT_STATUTORY,
      taxSlabRate: 0.1,
    });

    expect(amounts.grossPay).toBe(20000);
    expect(amounts.pfEmployee).toBe(2400); // 12% of basic
    expect(amounts.pfEmployer).toBe(2400);
    expect(amounts.esiEmployee).toBe(150); // 0.75% of gross (under ceiling)
    expect(amounts.esiEmployer).toBe(650); // 3.25% of gross
    expect(amounts.professionalTax).toBe(200);
    expect(amounts.labourWelfareFund).toBe(20);
    expect(amounts.incomeTax).toBe(1760); // 10% of (20000 - 2400)
    expect(amounts.totalEmployeeDeductions).toBe(2400 + 150 + 200 + 20 + 1760);
    expect(amounts.netPay).toBe(20000 - 4530);
  });

  it('applies ESI at the ceiling but not one rupee above it', () => {
    const atCeiling = calculatePayrollAmounts({
      baseSalary: ESI_WAGE_CEILING,
      overtimePay: 0,
      statutory: DEFAULT_STATUTORY,
      taxSlabRate: 0,
    });
    const aboveCeiling = calculatePayrollAmounts({
      baseSalary: ESI_WAGE_CEILING + 1,
      overtimePay: 0,
      statutory: DEFAULT_STATUTORY,
      taxSlabRate: 0,
    });

    expect(atCeiling.esiEmployee).toBeGreaterThan(0);
    expect(aboveCeiling.esiEmployee).toBe(0);
    expect(aboveCeiling.esiEmployer).toBe(0);
  });

  it('includes overtime in gross pay and TDS base, but calculates PF on basic only', () => {
    const amounts = calculatePayrollAmounts({
      baseSalary: 30000,
      overtimePay: 5000,
      statutory: DEFAULT_STATUTORY,
      taxSlabRate: 0.1,
    });

    expect(amounts.grossPay).toBe(35000);
    expect(amounts.pfEmployee).toBe(3600); // 12% of 30000 basic, overtime excluded
    expect(amounts.incomeTax).toBe(3140); // 10% of (35000 - 3600)
  });

  it('gratuity is an employer accrual and never reduces net pay', () => {
    const amounts = calculatePayrollAmounts({
      baseSalary: 24000,
      overtimePay: 0,
      statutory: DEFAULT_STATUTORY,
      taxSlabRate: 0,
    });

    expect(amounts.gratuityAccrual).toBeCloseTo((24000 * DEFAULT_STATUTORY.gratuityRate) / 12, 4);
    expect(amounts.totalEmployeeDeductions).toBe(
      amounts.pfEmployee +
        amounts.esiEmployee +
        amounts.professionalTax +
        amounts.labourWelfareFund +
        amounts.incomeTax,
    );
  });

  it('never produces negative net pay from deductions alone', () => {
    const amounts = calculatePayrollAmounts({
      baseSalary: 1000,
      overtimePay: 0,
      statutory: DEFAULT_STATUTORY,
      taxSlabRate: 0.3,
    });
    expect(amounts.netPay).toBeGreaterThanOrEqual(0);
  });
});

describe('resolveTaxSlabRate', () => {
  const slabs = [
    { minSalary: 0, maxSalary: 25000, rate: 0.05 },
    { minSalary: 25001, maxSalary: 50000, rate: 0.1 },
    { minSalary: 50001, maxSalary: null, rate: 0.2 },
  ];

  it('falls back to the default rate when no slabs are configured', () => {
    expect(resolveTaxSlabRate(30000, [])).toBe(0.12);
  });

  it('picks the slab whose range contains the salary', () => {
    expect(resolveTaxSlabRate(20000, slabs)).toBe(0.05);
    expect(resolveTaxSlabRate(30000, slabs)).toBe(0.1);
  });

  it('treats a null maxSalary as an open-ended top slab', () => {
    expect(resolveTaxSlabRate(1_000_000, slabs)).toBe(0.2);
  });

  it('uses slab boundaries inclusively', () => {
    expect(resolveTaxSlabRate(25000, slabs)).toBe(0.05);
    expect(resolveTaxSlabRate(50000, slabs)).toBe(0.1);
  });
});
