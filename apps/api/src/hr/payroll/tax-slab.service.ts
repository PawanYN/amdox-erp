import { Injectable } from '@nestjs/common';
import { prisma } from '@amdox/db';

@Injectable()
export class TaxSlabService {
  async create(
    tenantId: string,
    data: { name: string; minSalary: number; maxSalary?: number; rate: number },
  ) {
    return prisma.taxSlab.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return prisma.taxSlab.findMany({
      where: { tenantId },
      orderBy: { minSalary: 'asc' },
    });
  }

  async remove(tenantId: string, id: string) {
    return prisma.taxSlab.delete({
      where: { id, tenantId },
    });
  }
}
