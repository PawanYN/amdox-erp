import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AmdoxLogger } from '../logger/amdox-logger';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() === 'graphql') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const status = res.statusCode as number;
          const ms = Date.now() - start;
          const extra = `${ms}ms`;
          const msg = `${req.method} ${req.url}  →  ${status}`;

          if (status >= 500) {
            AmdoxLogger.error(msg, extra);
          } else if (status >= 400) {
            AmdoxLogger.warn(msg, extra);
          } else {
            AmdoxLogger.http(msg, extra);
          }
        },
        error: (err) => {
          const ms = Date.now() - start;
          const status = err?.status ?? 500;
          AmdoxLogger.error(
            `${req.method} ${req.url}  →  ${status}`,
            `${ms}ms  err=${err?.message ?? err}`,
          );
        },
      }),
    );
  }
}
