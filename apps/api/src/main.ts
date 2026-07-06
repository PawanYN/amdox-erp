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

  // Enable CORS so the Next.js frontend can make requests
  app.enableCors();

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
