import { tenantContext } from './context';

// Models that do NOT have a tenantId field should bypass the filter
const GLOBALLY_ACCESSIBLE_MODELS = ['Tenant', 'WebhookDelivery'];

// Shared by both the primary client (client.ts) and the replica client
// (replica-client.ts) so tenant isolation can't drift between them —
// a query run against the replica must be scoped exactly the same way
// as one run against the primary.
export const tenantScopeExtension = {
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        if (!GLOBALLY_ACCESSIBLE_MODELS.includes(model)) {
          const store = tenantContext.getStore();
          const tenantId = store?.tenantId;

          if (tenantId) {
            const anyArgs = args as any;
            if (operation === 'create' || operation === 'createMany') {
              // createMany `data` is an array — spreading it into `{ ...data, tenantId }`
              // turns indices into object keys and breaks Prisma validation.
              if (operation === 'createMany' && Array.isArray(anyArgs.data)) {
                anyArgs.data = anyArgs.data.map((row: Record<string, unknown>) => ({
                  ...row,
                  tenantId,
                }));
              } else {
                anyArgs.data = { ...anyArgs.data, tenantId };
              }
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
              anyArgs.where = { ...anyArgs.where, tenantId };
            }
          }
        }
        return query(args);
      },
    },
  },
};
