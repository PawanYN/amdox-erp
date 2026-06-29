import { PrismaClient } from '@prisma/client';
import { tenantContext } from './context';

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
export const prisma = prismaRaw.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Models that do NOT have a tenantId field should bypass the filter
        const globallyAccessibleModels = ['Tenant', 'WebhookDelivery']; // Add models here that don't have tenantId

        if (!globallyAccessibleModels.includes(model)) {
          const store = tenantContext.getStore();
          const tenantId = store?.tenantId;
          
          if (tenantId) {
            const anyArgs = args as any;
            if (operation === 'create' || operation === 'createMany') {
              // Inject into data
              anyArgs.data = { ...anyArgs.data, tenantId };
            } else if (
              operation === 'findUnique' || 
              operation === 'findFirst' || 
              operation === 'findMany' || 
              operation === 'update' || 
              operation === 'updateMany' || 
              operation === 'delete' || 
              operation === 'deleteMany' || 
              operation === 'count'
            ) {
              // Auto-inject tenantId into the where clause for data isolation
              anyArgs.where = { ...anyArgs.where, tenantId };
            }
          }
        }
        return query(args);
      },
    },
  },
});

// Also export the context so the NestJS middleware can set it
export { tenantContext } from './context';
export * from '@prisma/client';
