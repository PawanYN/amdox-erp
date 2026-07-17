import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { prisma } from '@amdox/db';
import { GqlAuthGuard } from './gql-auth.guard';

@Resolver()
export class GraphqlResolver {
  @Query(() => String, { description: 'API health summary via GraphQL' })
  health(): string {
    return 'ok';
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Number, { description: 'Count of active employees for the tenant' })
  async employeeCount(@Context() ctx: { tenantId?: string }): Promise<number> {
    const tenantId = ctx.tenantId || 'default-tenant-id';
    return prisma.employee.count({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    });
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Number, { description: 'Count of open projects for the tenant' })
  async projectCount(@Context() ctx: { tenantId?: string }): Promise<number> {
    const tenantId = ctx.tenantId || 'default-tenant-id';
    return prisma.project.count({
      where: { tenantId, status: 'ACTIVE' },
    });
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [String], { description: 'Search vendor names (GraphQL passthrough to DB)' })
  async searchVendors(
    @Context() ctx: { tenantId?: string },
    @Args('q', { defaultValue: '' }) q: string,
  ): Promise<string[]> {
    const tenantId = ctx.tenantId || 'default-tenant-id';
    const vendors = await prisma.vendor.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      take: 10,
      select: { name: true },
    });
    return vendors.map((v) => v.name);
  }
}
