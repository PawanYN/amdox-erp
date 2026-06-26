import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';

@Injectable()
export class TaxSlabService {
  private prisma = new PrismaClient();

  async create(tenantId: string, data: { name: string; minSalary: number; maxSalary?: number; rate: number }) {
    return this.prisma.taxSlab.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.taxSlab.findMany({
      where: { tenantId },
      orderBy: { minSalary: 'asc' },
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.taxSlab.delete({
      where: { id, tenantId },
    });
  }
}
