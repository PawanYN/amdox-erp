import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { prisma } from '@amdox/db';

const VENDOR_INDEX = 'amdox_vendors';
const PRODUCT_INDEX = 'amdox_products';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;
  private readonly enabled: boolean;

  constructor() {
    const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    this.client = new Client({ node });
    this.enabled = process.env.ELASTICSEARCH_ENABLED !== 'false';
  }

  async onModuleInit() {
    if (!this.enabled) return;
    try {
      await this.ensureIndices();
      await this.reindexAll('default-tenant-id').catch(() => undefined);
    } catch (err) {
      this.logger.warn(`Elasticsearch init skipped: ${(err as Error).message}`);
    }
  }

  async ping(): Promise<'connected' | 'disconnected'> {
    if (!this.enabled) return 'disconnected';
    try {
      const res = await this.client.ping();
      return res ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  private async ensureIndices() {
    for (const index of [VENDOR_INDEX, PRODUCT_INDEX]) {
      const exists = await this.client.indices.exists({ index });
      if (!exists) {
        await this.client.indices.create({
          index,
          mappings: {
            properties: {
              tenantId: { type: 'keyword' },
              name: { type: 'text' },
              sku: { type: 'keyword' },
              email: { type: 'keyword' },
            },
          },
        });
      }
    }
  }

  async reindexAll(tenantId: string) {
    const vendors = await prisma.vendor.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, tenantId: true, name: true, email: true },
    });
    const products = await prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, tenantId: true, name: true, sku: true },
    });

    const vendorOps = vendors.flatMap((v) => [
      { index: { _index: VENDOR_INDEX, _id: v.id } },
      { tenantId: v.tenantId, name: v.name, email: v.email ?? '' },
    ]);
    const productOps = products.flatMap((p) => [
      { index: { _index: PRODUCT_INDEX, _id: p.id } },
      { tenantId: p.tenantId, name: p.name, sku: p.sku },
    ]);

    if (vendorOps.length) await this.client.bulk({ refresh: true, operations: vendorOps });
    if (productOps.length) await this.client.bulk({ refresh: true, operations: productOps });

    return { vendors: vendors.length, products: products.length };
  }

  async search(tenantId: string, query: string, limit = 20) {
    if (!this.enabled) {
      return this.dbFallbackSearch(tenantId, query, limit);
    }

    try {
      const [vendorHits, productHits] = await Promise.all([
        this.client.search({
          index: VENDOR_INDEX,
          size: limit,
          query: {
            bool: {
              must: [
                { term: { tenantId } },
                {
                  multi_match: {
                    query,
                    fields: ['name', 'email'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
            },
          },
        }),
        this.client.search({
          index: PRODUCT_INDEX,
          size: limit,
          query: {
            bool: {
              must: [
                { term: { tenantId } },
                {
                  multi_match: {
                    query,
                    fields: ['name', 'sku'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
            },
          },
        }),
      ]);

      return {
        vendors: vendorHits.hits.hits.map((h) => ({ id: h._id, ...(h._source as object) })),
        products: productHits.hits.hits.map((h) => ({ id: h._id, ...(h._source as object) })),
      };
    } catch (err) {
      this.logger.warn(`ES search failed, using DB fallback: ${(err as Error).message}`);
      return this.dbFallbackSearch(tenantId, query, limit);
    }
  }

  private async dbFallbackSearch(tenantId: string, query: string, limit: number) {
    const q = { contains: query, mode: 'insensitive' as const };
    const [vendors, products] = await Promise.all([
      prisma.vendor.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: q }, { email: q }] },
        take: limit,
        select: { id: true, name: true, email: true },
      }),
      prisma.product.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: q }, { sku: q }] },
        take: limit,
        select: { id: true, name: true, sku: true },
      }),
    ]);
    return { vendors, products };
  }
}
