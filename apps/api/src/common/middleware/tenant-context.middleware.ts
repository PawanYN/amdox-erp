import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from '@amdox/db';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // We expect the JWT strategy (or some auth mechanism) to populate req.user
    // OR we fallback to a header 'x-tenant-id' for testing without Keycloak
    let tenantId = (req.user as any)?.tenantId;
    
    if (!tenantId) {
      tenantId = req.headers['x-tenant-id'] as string;
    }

    if (tenantId) {
      // Run the rest of the request inside the AsyncLocalStorage context
      tenantContext.run({ tenantId }, () => {
        next();
      });
    } else {
      // If no tenant context is found, just continue (useful for public routes)
      next();
    }
  }
}
