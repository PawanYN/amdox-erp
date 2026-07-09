import { PrismaClient } from '@prisma/client';
import { tenantScopeExtension } from './tenant-scope-extension';

declare global {
  // eslint-disable-next-line no-var
  var prismaRaw: PrismaClient | undefined;
}

// Keep a reference to the raw client internally
const prismaRaw = globalThis.prismaRaw || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaRaw = prismaRaw;
}

// We extend the PrismaClient to automatically inject `tenantId` into queries
// based on the AsyncLocalStorage context.
export const prisma = prismaRaw.$extends(tenantScopeExtension);
export type ScopedPrismaClient = typeof prisma;

// Also export the context so the NestJS middleware can set it
export { tenantContext } from './context';
export * from '@prisma/client';
