import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from '@amdox/db';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let tenantId = (req.user as any)?.tenantId || (req.headers['x-tenant-id'] as string);

    // If tenantId is not present yet (middleware runs before AuthGuard), inspect JWT Bearer token
    let logTenant = tenantId;
    if (!logTenant) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const payloadBase64 = token.split('.')[1];
          if (payloadBase64) {
            const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
            logTenant = payload.iss?.split('/realms/').pop();
          }
        } catch {}
      }
    }

    if (logTenant) {
      console.log(`[Request] ${req.method} ${req.originalUrl} | Tenant: \x1b[33m${logTenant}\x1b[0m`);
    } else {
      console.log(`[Request] ${req.method} ${req.originalUrl} | Tenant: \x1b[31mNone\x1b[0m`);
    }

    if (tenantId) {
      tenantContext.run({ tenantId }, () => {
        next();
      });
    } else {
      next();
    }
  }
}
