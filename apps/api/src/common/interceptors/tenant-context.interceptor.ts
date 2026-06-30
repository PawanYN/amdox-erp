import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tenantContext } from '@amdox/db';
import { Observable } from 'rxjs';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.user?.tenantId; // This is the UUID populated by KeycloakStrategy

    if (tenantId) {
      return new Observable((subscriber) => {
        tenantContext.run({ tenantId }, () => {
          next.handle().subscribe(subscriber);
        });
      });
    }

    return next.handle();
  }
}
