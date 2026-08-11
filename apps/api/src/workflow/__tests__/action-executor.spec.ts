import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ActionExecutor } from '../action-executor';
import { JournalEntryService } from '../../finance/gl/journal-entry.service';
import { NotificationService } from '../../notification/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

// executeSendNotification resolves the interpolated "to" email against the
// User table, so the shared Prisma client needs a mock regardless of which
// address a given test uses.
vi.mock('@amdox/db', () => ({
  prisma: {
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'resolved-user-id' }) },
  },
}));

describe('ActionExecutor', () => {
  let service: ActionExecutor;
  let journalEntryService: JournalEntryService;
  let notificationService: NotificationService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionExecutor,
        {
          provide: JournalEntryService,
          useValue: {
            getAccounts: vi.fn().mockResolvedValue([
              { id: 'acc-1300', code: '1300' },
              { id: 'acc-2000', code: '2000' },
            ]),
            getOrCreateCurrentFiscalPeriod: vi.fn().mockResolvedValue({ id: 'fp-1' }),
            createJournalEntry: vi.fn().mockResolvedValue({ id: 'je-001' }),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            notify: vi.fn().mockResolvedValue({ id: 'notif-001' }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ActionExecutor>(ActionExecutor);
    journalEntryService = module.get<JournalEntryService>(JournalEntryService);
    notificationService = module.get<NotificationService>(NotificationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('post_gl action', () => {
    it('should post GL entries', async () => {
      const action = {
        id: 'action-1',
        type: 'post_gl' as const,
        config: {
          glEntries: [
            {
              account: '1300',
              debit: '5000',
              credit: 0,
              description: 'Test entry',
            },
            {
              account: '2000',
              debit: 0,
              credit: '5000',
              description: 'Test entry',
            },
          ],
        },
      };

      const document = { id: 'doc-123', totalAmount: 5000 };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const result = await service.execute(action, document, context);

      expect(result.status).toBe('success');
      expect(journalEntryService.createJournalEntry).toHaveBeenCalled();
    });

    it('should interpolate template variables in GL entries', async () => {
      const action = {
        id: 'action-2',
        type: 'post_gl' as const,
        config: {
          glEntries: [
            {
              account: '1300',
              debit: '{{totalAmount}}',
              credit: 0,
              description: 'PO {{poNumber}} approved',
            },
          ],
        },
      };

      const document = { id: 'doc-123', totalAmount: 5000, poNumber: 'PO-001' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      await service.execute(action, document, context);

      const calls = (journalEntryService.createJournalEntry as Mock).mock.calls;
      expect(calls[0][1].lines[0].debit).toBe(5000);
      expect(calls[0][1].description).toBe('PO PO-001 approved');
    });

    it('should throw error if GL account not found', async () => {
      const action = {
        id: 'action-3',
        type: 'post_gl' as const,
        config: {
          glEntries: [
            {
              account: '9999',
              debit: '5000',
              credit: 0,
              description: 'Test',
            },
          ],
        },
        failureAction: 'block_transition' as const,
      };

      const document = { id: 'doc-123' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      await expect(service.execute(action, document, context)).rejects.toThrow();
    });
  });

  describe('send_notification action', () => {
    it('should send notification', async () => {
      const action = {
        id: 'action-4',
        type: 'send_notification' as const,
        config: {
          to: 'user@company.com',
          subject: 'PO Approved',
          body: 'Your purchase order has been approved.',
        },
      };

      const document = { id: 'doc-123' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const result = await service.execute(action, document, context);

      expect(result.status).toBe('success');
      expect(notificationService.notify).toHaveBeenCalled();
    });

    it('should interpolate template variables in notification', async () => {
      const action = {
        id: 'action-5',
        type: 'send_notification' as const,
        config: {
          to: '{{createdBy.email}}',
          subject: 'PO {{poNumber}} Approved',
          body: 'Amount: ${{totalAmount}}',
        },
      };

      const document = {
        id: 'doc-123',
        poNumber: 'PO-001',
        totalAmount: 5000,
        createdBy: { email: 'creator@company.com' },
      };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      await service.execute(action, document, context);

      const calls = (notificationService.notify as Mock).mock.calls;
      expect(calls[0][0].title).toBe('PO PO-001 Approved');
    });

    it('should not throw on notification failure if failureAction is log_warning', async () => {
      (notificationService.notify as Mock).mockRejectedValueOnce(
        new Error('Notification service down'),
      );

      const action = {
        id: 'action-6',
        type: 'send_notification' as const,
        config: {
          to: 'user@company.com',
          subject: 'Test',
          body: 'Test',
        },
        failureAction: 'log_warning' as const,
      };

      const document = { id: 'doc-123' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const result = await service.execute(action, document, context);

      expect(result.status).toBe('failure');
      expect(result.error).toBeDefined();
    });
  });

  describe('update_field action', () => {
    it('should return update instruction for whitelisted field', async () => {
      const action = {
        id: 'action-7',
        type: 'update_field' as const,
        config: {
          field: 'status',
          value: 'approved',
        },
      };

      const document = { id: 'doc-123', status: 'draft' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const result = await service.execute(action, document, context);

      expect(result.status).toBe('success');
      expect(result.result.field).toBe('status');
      expect(result.result.value).toBe('approved');
    });

    it('should throw error for non-whitelisted field', async () => {
      const action = {
        id: 'action-8',
        type: 'update_field' as const,
        config: {
          field: 'password', // Not whitelisted
          value: 'new-password',
        },
        failureAction: 'block_transition' as const,
      };

      const document = { id: 'doc-123' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      await expect(service.execute(action, document, context)).rejects.toThrow(BadRequestException);
    });
  });

  describe('trigger_event action', () => {
    it('should emit event', async () => {
      const action = {
        id: 'action-9',
        type: 'trigger_event' as const,
        config: {
          event: 'po.approved',
          payload: { poId: 'po-123', amount: 5000 },
        },
      };

      const document = { id: 'doc-123', poNumber: 'PO-001' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const result = await service.execute(action, document, context);

      expect(result.status).toBe('success');
      expect(eventEmitter.emit).toHaveBeenCalledWith('po.approved', expect.any(Object));
    });

    it('should interpolate template variables in event payload', async () => {
      const action = {
        id: 'action-10',
        type: 'trigger_event' as const,
        config: {
          event: 'po.approved',
          payload: { poId: '{{docId}}', amount: '{{totalAmount}}' },
        },
      };

      const document = { id: 'doc-123', docId: 'doc-123', totalAmount: 5000 };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      await service.execute(action, document, context);

      const calls = (eventEmitter.emit as Mock).mock.calls;
      expect(calls[0][1].poId).toBe('doc-123');
      expect(calls[0][1].amount).toBe('5000');
    });
  });

  describe('template interpolation', () => {
    it('should handle nested field access', async () => {
      const action = {
        id: 'action-11',
        type: 'send_notification' as const,
        config: {
          to: '{{vendor.email}}',
          subject: 'Test',
          body: 'Test',
        },
      };

      const document = { vendor: { email: 'vendor@company.com' } };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const result = await service.execute(action, document, context);

      expect(result.result.to).toBe('vendor@company.com');
    });

    it('should handle array access', async () => {
      const action = {
        id: 'action-12',
        type: 'send_notification' as const,
        config: {
          to: '{{lineItems[0].vendorEmail}}',
          subject: 'Test',
          body: 'Test',
        },
      };

      const document = {
        lineItems: [{ vendorEmail: 'vendor1@company.com' }, { vendorEmail: 'vendor2@company.com' }],
      };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const result = await service.execute(action, document, context);

      expect(result.result.to).toBe('vendor1@company.com');
    });
  });

  describe('executeAll', () => {
    it('should execute all actions in sequence', async () => {
      const actions = [
        {
          id: 'a1',
          type: 'post_gl' as const,
          config: {
            glEntries: [{ account: '1300', debit: '5000', credit: 0, description: 'Test' }],
          },
        },
        {
          id: 'a2',
          type: 'trigger_event' as const,
          config: { event: 'po.approved', payload: {} },
        },
      ];

      const document = { id: 'doc-123' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      const results = await service.executeAll(actions, document, context);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('success');
    });

    it('should stop on first failure if failureAction is block_transition', async () => {
      const actions = [
        {
          id: 'a1',
          type: 'post_gl' as const,
          config: { glEntries: [] },
          failureAction: 'block_transition' as const,
        },
        {
          id: 'a2',
          type: 'trigger_event' as const,
          config: { event: 'po.approved', payload: {} },
        },
      ];

      const document = { id: 'doc-123' };
      const context = { tenantId: 'default', userId: 'user-1', docType: 'PO', docId: 'doc-123' };

      await expect(service.executeAll(actions, document, context)).rejects.toThrow();
    });
  });
});
