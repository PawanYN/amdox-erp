import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma } from '@amdox/db';
import { WorkflowAction } from './entities/workflow-definition.entity';
import { ActionExecutionResult } from './entities/workflow-instance.entity';
import { JournalEntryService } from '../finance/gl/journal-entry.service';
import { NotificationService } from '../notification/notification.service';

interface ExecutionContext {
  tenantId: string;
  userId: string;
  docType: string;
  docId: string;
}

@Injectable()
export class ActionExecutor {
  private readonly logger = new Logger(ActionExecutor.name);

  constructor(
    private journalEntryService: JournalEntryService,
    private notificationService: NotificationService,
    private eventEmitter: EventEmitter2,
  ) {}

  async execute(
    action: WorkflowAction,
    document: any,
    context: ExecutionContext,
  ): Promise<ActionExecutionResult> {
    try {
      let result: any;

      switch (action.type) {
        case 'post_gl':
          result = await this.executePostGl(action, document, context);
          break;
        case 'send_notification':
          result = await this.executeSendNotification(action, document, context);
          break;
        case 'update_field':
          result = this.executeUpdateField(action, document);
          break;
        case 'trigger_event':
          result = this.executeTriggerEvent(action, document);
          break;
        case 'webhook':
          result = await this.executeWebhook(action, document);
          break;
        case 'snapshot':
          result = this.executeSnapshot(action, document);
          break;
        default:
          throw new BadRequestException(`Unknown action type: ${action.type}`);
      }

      return {
        actionId: action.id,
        type: action.type,
        status: 'success',
        result,
      };
    } catch (error: any) {
      this.logger.error(`Action execution failed: ${error.message}`, error.stack);

      if (action.failureAction === 'block_transition') {
        throw error; // Re-throw to block transition
      }

      return {
        actionId: action.id,
        type: action.type,
        status: 'failure',
        error: error.message,
      };
    }
  }

  async executeAll(
    actions: WorkflowAction[],
    document: any,
    context: ExecutionContext,
  ): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];

    for (const action of actions) {
      const result = await this.execute(action, document, context);
      results.push(result);

      // If this action fails and blocks transitions, stop execution
      if (result.status === 'failure' && action.failureAction === 'block_transition') {
        throw new BadRequestException(`Action "${action.type}" failed: ${result.error}`);
      }
    }

    return results;
  }

  private async executePostGl(
    action: WorkflowAction,
    document: any,
    context: ExecutionContext,
  ): Promise<any> {
    const glEntries = action.config.glEntries || [];

    if (!glEntries.length) {
      throw new BadRequestException('GL action requires glEntries');
    }

    const interpolatedEntries = glEntries.map((entry) => ({
      account: entry.account,
      debit: Number(this.interpolate(String(entry.debit), document)),
      credit: Number(this.interpolate(String(entry.credit), document)),
      description: this.interpolate(entry.description, document),
    }));

    const accounts = await this.journalEntryService.getAccounts(context.tenantId);
    const accountsByCode = new Map(accounts.map((a) => [a.code, a]));

    const lines = interpolatedEntries.map((entry) => {
      const account = accountsByCode.get(entry.account);
      if (!account) {
        throw new BadRequestException(
          `GL action references unknown account code "${entry.account}"`,
        );
      }
      return { accountId: account.id, debit: entry.debit, credit: entry.credit };
    });

    const fiscalPeriod = await this.journalEntryService.getOrCreateCurrentFiscalPeriod(
      context.tenantId,
    );

    const journalEntry = await this.journalEntryService.createJournalEntry(
      context.tenantId,
      {
        fiscalPeriodId: fiscalPeriod.id,
        reference: `WF-${context.docType}-${document.id || context.docId}`,
        description: interpolatedEntries[0]?.description,
        sourceModule: 'workflow',
        sourceId: document.id || context.docId,
        lines,
      },
      context.userId,
    );

    return {
      glEntries: interpolatedEntries,
      journalEntryId: journalEntry.id,
    };
  }

  private async executeSendNotification(
    action: WorkflowAction,
    document: any,
    context: ExecutionContext,
  ): Promise<any> {
    const to = this.interpolate(action.config.to || '', document);
    const subject = this.interpolate(action.config.subject || '', document);
    const body = this.interpolate(action.config.body || '', document);

    if (!to || !subject || !body) {
      throw new BadRequestException('Notification requires to, subject, and body');
    }

    // The notification system delivers to internal users by userId, not
    // arbitrary email addresses, so resolve `to` (an interpolated email)
    // against the tenant's users. External recipients (e.g. a vendor email
    // with no user account) have nowhere to be delivered — log and skip
    // rather than fail the whole transition over an unreachable address.
    const targetUser = await prisma.user.findFirst({
      where: { tenantId: context.tenantId, email: to },
      select: { id: true },
    });

    if (!targetUser) {
      this.logger.warn(
        `Workflow notification skipped: no user found for "${to}" in tenant ${context.tenantId}`,
      );
      return { to, subject, body, delivered: false };
    }

    await this.notificationService.notify({
      tenantId: context.tenantId,
      eventType: 'workflow.notification',
      title: subject,
      body,
      userId: targetUser.id,
    });

    return { to, subject, body, delivered: true };
  }

  private executeUpdateField(action: WorkflowAction, document: any): any {
    const { field, value } = action.config;

    if (!field) {
      throw new BadRequestException('Update field action requires "field" and "value"');
    }

    // Whitelist of allowed fields (prevent arbitrary data modification)
    const allowedFields = ['status', 'approvalStatus', 'approvedAt', 'approvedBy'];

    if (!allowedFields.includes(field)) {
      throw new BadRequestException(
        `Field "${field}" is not allowed to be updated via workflow. Allowed: ${allowedFields.join(', ')}`,
      );
    }

    return {
      field,
      value,
      message: `Field "${field}" should be updated to "${value}"`,
    };
  }

  private executeTriggerEvent(action: WorkflowAction, document: any): any {
    const { event, payload } = action.config;

    if (!event) {
      throw new BadRequestException('Trigger event action requires "event"');
    }

    const interpolatedPayload = this.interpolateObject(payload || {}, document);

    this.eventEmitter.emit(event, interpolatedPayload);

    return {
      event,
      payload: interpolatedPayload,
    };
  }

  private async executeWebhook(action: WorkflowAction, document: any): Promise<any> {
    const { url, method = 'POST', headers = {}, body } = action.config;

    if (!url) {
      throw new BadRequestException('Webhook action requires "url"');
    }

    const interpolatedBody = this.interpolateObject(body || {}, document);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method !== 'GET' ? JSON.stringify(interpolatedBody) : undefined,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      return {
        url,
        method,
        statusCode: response.status,
        success: true,
      };
    } catch (error: any) {
      throw new BadRequestException(`Webhook request failed: ${error.message}`);
    }
  }

  private executeSnapshot(action: WorkflowAction, document: any): any {
    const fields = action.config.fields || Object.keys(document);

    const snapshot = fields.reduce((acc, field) => {
      acc[field] = document[field];
      return acc;
    }, {});

    return {
      snapshotFields: fields,
      snapshot,
    };
  }

  private interpolate(template: string, document: any): string {
    if (!template) return template;

    return template.replace(/\{\{([\w.[\]]+)\}\}/g, (match, fieldPath) => {
      const value = this.getFieldValue(document, fieldPath);
      return value !== undefined ? String(value) : match;
    });
  }

  private interpolateObject(obj: any, document: any): any {
    if (typeof obj === 'string') {
      return this.interpolate(obj, document);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObject(item, document));
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        acc[key] = this.interpolateObject(value, document);
        return acc;
      }, {});
    }

    return obj;
  }

  private getFieldValue(document: any, field: string): any {
    if (!field) return undefined;

    const parts = field.split('.');
    let value = document;

    for (const part of parts) {
      if (!value) return undefined;

      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        value = value[key]?.[index];
      } else {
        value = value[part];
      }
    }

    return value;
  }
}
