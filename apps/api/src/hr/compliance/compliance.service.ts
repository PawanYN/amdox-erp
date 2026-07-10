import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@amdox/db';
import { TaxSlabService } from '../payroll/tax-slab.service';
import { DEFAULT_STATUTORY, StatutoryComplianceConfig } from '../payroll/payroll-deductions';

export type { StatutoryComplianceConfig };

@Injectable()
export class ComplianceService {
  constructor(private readonly taxSlabService: TaxSlabService) {}

  async getStatutoryCompliance(tenantId: string): Promise<StatutoryComplianceConfig> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, unknown> | null) ?? {};
    const stored = settings.statutoryCompliance as Partial<StatutoryComplianceConfig> | undefined;
    return { ...DEFAULT_STATUTORY, ...stored };
  }

  async updateStatutoryCompliance(tenantId: string, config: Partial<StatutoryComplianceConfig>) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
    const current = (settings.statutoryCompliance as Partial<StatutoryComplianceConfig>) ?? {};
    const merged = { ...DEFAULT_STATUTORY, ...current, ...config };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: { ...settings, statutoryCompliance: merged },
      },
    });
    return merged;
  }

  listTaxSlabs(tenantId: string) {
    return this.taxSlabService.findAll(tenantId);
  }

  createTaxSlab(
    tenantId: string,
    data: { name: string; minSalary: number; maxSalary?: number; rate: number },
  ) {
    return this.taxSlabService.create(tenantId, data);
  }

  removeTaxSlab(tenantId: string, id: string) {
    return this.taxSlabService.remove(tenantId, id);
  }
}
