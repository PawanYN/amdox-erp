import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { HashChainService } from './hash-chain.service';
import { AuditEventListener } from './audit-event.listener';
import { GdprController } from './gdpr/gdpr.controller';
import { GdprService } from './gdpr/gdpr.service';

@Module({
  controllers: [AuditController, GdprController],
  providers: [
    AuditService,
    HashChainService,
    AuditEventListener,
    GdprService,
  ],
  exports: [AuditService],
})
export class AuditModule {}
