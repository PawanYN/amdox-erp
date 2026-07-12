/**
 * Gross-to-net payroll math using tenant statutory compliance settings.
 *
 * Employee-side deductions (reduce net pay): PF, ESI, PT, LWF, income tax (TDS).
 * Employer-side amounts (informational on payslip): PF, ESI, gratuity accrual.
 */
export interface StatutoryComplianceConfig {
  pfEmployeeRate: number;
  pfEmployerRate: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  professionalTaxMonthly: number;
  gratuityRate: number;
  labourWelfareFund: number;
  notes?: string;
}

export const DEFAULT_STATUTORY: StatutoryComplianceConfig = {
  pfEmployeeRate: 0.12,
  pfEmployerRate: 0.12,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  professionalTaxMonthly: 200,
  gratuityRate: 0.0481,
  labourWelfareFund: 20,
  notes: '',
};

/** ESI applies only when gross monthly wages are at or below this ceiling (INR). */
export const ESI_WAGE_CEILING = 21000;

export interface PayrollAmounts {
  baseSalary: number;
  overtimePay: number;
  grossPay: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  labourWelfareFund: number;
  incomeTax: number;
  gratuityAccrual: number;
  totalEmployeeDeductions: number;
  netPay: number;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

/**
 * Compute payslip amounts from base salary, overtime, statutory config, and TDS slab rate.
 */
export function calculatePayrollAmounts(params: {
  baseSalary: number;
  overtimePay: number;
  statutory: StatutoryComplianceConfig;
  taxSlabRate: number;
}): PayrollAmounts {
  const { baseSalary, overtimePay, statutory, taxSlabRate } = params;
  const grossPay = round4(baseSalary + overtimePay);

  // PF is calculated on basic salary (contract amount), not overtime.
  const pfEmployee = round4(baseSalary * statutory.pfEmployeeRate);
  const pfEmployer = round4(baseSalary * statutory.pfEmployerRate);

  const esiApplicable = grossPay <= ESI_WAGE_CEILING;
  const esiEmployee = esiApplicable ? round4(grossPay * statutory.esiEmployeeRate) : 0;
  const esiEmployer = esiApplicable ? round4(grossPay * statutory.esiEmployerRate) : 0;

  const professionalTax = round4(statutory.professionalTaxMonthly);
  const labourWelfareFund = round4(statutory.labourWelfareFund);

  // TDS on taxable income after employee PF (simplified monthly withholding).
  const taxableForTds = Math.max(0, grossPay - pfEmployee);
  const incomeTax = round4(taxableForTds * taxSlabRate);

  // Gratuity is an employer accrual — not deducted from the employee's net pay.
  const gratuityAccrual = round4((baseSalary * statutory.gratuityRate) / 12);

  const totalEmployeeDeductions = round4(
    pfEmployee + esiEmployee + professionalTax + labourWelfareFund + incomeTax,
  );
  const netPay = round4(grossPay - totalEmployeeDeductions);

  return {
    baseSalary: round4(baseSalary),
    overtimePay: round4(overtimePay),
    grossPay,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    professionalTax,
    labourWelfareFund,
    incomeTax,
    gratuityAccrual,
    totalEmployeeDeductions,
    netPay,
  };
}

/** Resolve income-tax slab rate for a given base salary. */
export function resolveTaxSlabRate(
  baseSalary: number,
  taxSlabs: { minSalary: unknown; maxSalary?: unknown | null; rate: unknown }[],
  fallbackRate = 0.12,
): number {
  if (taxSlabs.length === 0) return fallbackRate;
  const slab = taxSlabs.find(
    (s) => baseSalary >= Number(s.minSalary) && (!s.maxSalary || baseSalary <= Number(s.maxSalary)),
  );
  return slab ? Number(slab.rate) : fallbackRate;
}

/** Reconstruct a payslip view from stored totals when line-item breakdown is unavailable. */
export function legacyPayslipAmounts(
  grossPay: number,
  totalEmployeeDeductions: number,
  netPay: number,
): PayrollAmounts {
  return {
    baseSalary: grossPay,
    overtimePay: 0,
    grossPay,
    pfEmployee: 0,
    pfEmployer: 0,
    esiEmployee: 0,
    esiEmployer: 0,
    professionalTax: 0,
    labourWelfareFund: 0,
    incomeTax: totalEmployeeDeductions,
    gratuityAccrual: 0,
    totalEmployeeDeductions,
    netPay,
  };
}
