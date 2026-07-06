import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches every unhandled exception in the app and converts it into a single,
 * consistent JSON error shape. `HttpLoggingInterceptor` already logs the error
 * server-side (via AmdoxLogger) — this filter only shapes the client-facing
 * response, so it does not log again.
 *
 * Raw (non-HttpException) errors are never sent to the client as-is in
 * production, since they can leak internal details (DB driver messages, stack
 * traces, file paths).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as Record<string, unknown>).message ?? exception.message);

      response.status(status).json({
        statusCode: status,
        message,
        error: exception.name,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const isProd = process.env.NODE_ENV === 'production';
    const rawMessage = exception instanceof Error ? exception.message : 'Unknown error';

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProd ? 'Internal server error' : rawMessage,
      error: 'InternalServerError',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
