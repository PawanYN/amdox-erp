import { PrismaClient } from '@prisma/client';
import { tenantScopeExtension } from './tenant-scope-extension';
import type { ScopedPrismaClient } from './client';

declare global {
  // eslint-disable-next-line no-var
  var prismaReplicaRaw: PrismaClient | undefined;
}

const replicaUrl = process.env.DATABASE_REPLICA_URL;

// undefined when DATABASE_REPLICA_URL isn't set — queryReplicaOrPrimary below
// falls back to the primary client in that case, so a replica is optional
// infrastructure, not a hard requirement to boot the app.
const prismaReplicaRaw: PrismaClient | undefined = replicaUrl
  ? globalThis.prismaReplicaRaw || new PrismaClient({ datasources: { db: { url: replicaUrl } } })
  : undefined;

if (process.env.NODE_ENV !== 'production' && prismaReplicaRaw) {
  globalThis.prismaReplicaRaw = prismaReplicaRaw;
}

// Same tenant-scoping wrapper as the primary client (client.ts) — a query
// against the replica must stay exactly as tenant-isolated as one against
// the primary.
export const prismaReplica: ScopedPrismaClient | undefined = prismaReplicaRaw?.$extends(tenantScopeExtension);

/**
 * Runs `fn` against the read replica; falls back to the primary `prisma`
 * client (from client.ts) if no replica is configured or the replica query
 * fails — a replica outage should make reporting queries slower, not break
 * the endpoint. Imports `prisma` lazily to avoid a circular import between
 * client.ts and replica-client.ts.
 */
export async function queryReplicaOrPrimary<T>(fn: (client: ScopedPrismaClient) => Promise<T>): Promise<T> {
  const { prisma } = await import('./client.js');

  if (!prismaReplica) {
    return fn(prisma);
  }

  try {
    return await fn(prismaReplica);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[replica] query failed, falling back to primary: ${(err as Error).message}`);
    return fn(prisma);
  }
}
