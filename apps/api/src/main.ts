import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from the root .env file
dotenv.config();
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { getQueueToken } from '@nestjs/bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { AmdoxLogger } from './common/logger/amdox-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino as the core logger for NestJS
  app.useLogger(app.get(Logger));

  // Security headers: HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP.
  // Swagger UI and Bull Board serve their own inline scripts/styles, so their exact
  // routes get a relaxed policy below instead of weakening the default for everything.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Helmet 8 dropped its built-in Permissions-Policy middleware (the policy is too
  // app-specific to have a sane default) — this is a pure API with no need for any of
  // these browser features, so disable them all outright.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    next();
  });

  // Explicit CORS allowlist — no more open-to-any-origin default. FRONTEND_URL supports
  // a comma-separated list so staging/prod can allow multiple known frontend origins.
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Swagger UI and Bull Board both render inline <script>/<style> tags of their own,
  // which the strict default CSP above would block. Relax it only for these two paths
  // (registered before their routers below, so it takes effect for their requests).
  app.use(
    ['/api-docs', '/admin/queues'],
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Enforce strict validation rules across the entire API
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // Generate the interactive API Menu (Swagger UI)
  const config = new DocumentBuilder()
    .setTitle('Amdox ERP API')
    .setDescription('Strict, enterprise-grade endpoints for Finance, HR, and SCM')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Auto-generate the OpenAPI spec for Postman
  fs.writeFileSync(
    path.join(process.cwd(), 'openapi-spec.json'),
    JSON.stringify(document, null, 2),
  );

  // Bull Board — retry/dead-letter dashboard for BullMQ queues, gated by HTTP Basic Auth
  // so it isn't a wide-open admin surface. Credentials come from BULL_BOARD_USER/PASSWORD.
  const notificationQueue = app.get<Queue>(getQueueToken('notification-dispatch'));
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [new BullMQAdapter(notificationQueue)],
    serverAdapter,
  });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/admin/queues', (req: Request, res: Response, next: NextFunction) => {
    const expectedUser = process.env.BULL_BOARD_USER;
    const expectedPassword = process.env.BULL_BOARD_PASSWORD;
    const header = req.headers.authorization;
    const provided = header?.startsWith('Basic ')
      ? Buffer.from(header.slice(6), 'base64').toString('utf8')
      : undefined;
    if (!expectedUser || !expectedPassword || provided !== `${expectedUser}:${expectedPassword}`) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Authentication required');
      return;
    }
    next();
  });
  expressApp.use('/admin/queues', serverAdapter.getRouter());

  // Set up port from env or default to 3001
  const port = process.env.PORT || 3001;
  await app.listen(port);

  AmdoxLogger.divider('AMDOX ERP API');
  AmdoxLogger.brand('Server ready', `http://localhost:${port}`);
  AmdoxLogger.brand('API docs  ', `http://localhost:${port}/api-docs`);
  AmdoxLogger.divider();
}
bootstrap();
