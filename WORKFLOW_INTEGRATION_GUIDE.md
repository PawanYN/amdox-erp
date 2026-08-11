# Workflow Engine Integration Guide

**How to Integrate the Workflow Engine with Existing Modules**

---

## Quick Start

### Step 1: Add WorkflowModule to Your Module

```typescript
// scm/purchase-order/purchase-order.module.ts
import { Module } from '@nestjs/common';
import { WorkflowModule } from '../../workflow/workflow.module';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderListener } from './purchase-order.listener';

@Module({
  imports: [WorkflowModule],
  providers: [PurchaseOrderService, PurchaseOrderListener],
  controllers: [PurchaseOrderController],
})
export class PurchaseOrderModule {}
```

---

## Integration Patterns

### Pattern 1: Initialize Workflow on Document Creation

When a user creates a purchase order, automatically initialize its workflow.

```typescript
// purchase-order.service.ts
import { WorkflowService } from '../../workflow/workflow.service';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private prisma: PrismaService,
    private workflowService: WorkflowService,
  ) {}

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, user: User): Promise<PurchaseOrder> {
    // Create the PO
    const po = await this.prisma.purchaseOrder.create({
      data: {
        ...dto,
        createdBy: user.id,
        tenantId: user.tenantId,
        status: 'DRAFT', // Maps to workflow state 'draft'
      },
    });

    // Initialize workflow for this PO
    try {
      await this.workflowService.initializeWorkflow('PurchaseOrder', po.id, user.tenantId);
    } catch (error) {
      // Log warning - workflow might not be configured yet
      console.warn(`Could not initialize workflow for PO ${po.id}: ${error.message}`);
    }

    return po;
  }
}
```

---

### Pattern 2: Enforce Workflow State Before Editing

Prevent edits when the document is in a state that doesn't allow editing.

```typescript
// purchase-order.service.ts
async updatePurchaseOrder(id: string, dto: UpdatePurchaseOrderDto, user: User): Promise<PurchaseOrder> {
  // Check if workflow state allows editing
  try {
    const instance = await this.workflowService.getWorkflowInstance(
      'PurchaseOrder',
      id,
      user.tenantId,
    );

    const workflow = await this.workflowService.getWorkflow(instance.workflowDefinitionId, user.tenantId);
    const currentState = workflow.states.find((s) => s.id === instance.currentStateId);

    if (!currentState.allowEdit) {
      throw new ForbiddenException(
        `Cannot edit PO in "${currentState.label}" state. Please contact your manager.`,
      );
    }
  } catch (error) {
    if (error instanceof ForbiddenException) throw error;
    // If workflow not found, allow edit (backward compatibility)
  }

  // Update the PO
  return this.prisma.purchaseOrder.update({
    where: { id },
    data: dto,
  });
}
```

---

### Pattern 3: Get Available Transitions

Show users what actions they can take next.

```typescript
// purchase-order.controller.ts
import { WorkflowService } from '../../workflow/workflow.service';

@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(
    private poService: PurchaseOrderService,
    private workflowService: WorkflowService,
  ) {}

  @Get(':id/available-actions')
  async getAvailableActions(@Param('id') id: string, @Req() req: any) {
    const user = this.extractUser(req);
    const po = await this.poService.getPurchaseOrder(id);

    try {
      const instance = await this.workflowService.getWorkflowInstance(
        'PurchaseOrder',
        id,
        user.tenantId,
      );

      const workflow = await this.workflowService.getWorkflow(
        instance.workflowDefinitionId,
        user.tenantId,
      );

      const availableTransitions = await this.workflowService.getAvailableTransitions(
        instance,
        workflow,
        user,
      );

      return {
        currentState: instance.currentStateLabel,
        availableActions: availableTransitions.map((t) => ({
          label: t.label,
          allowed: t.allowed,
          reason: t.reason, // Why it's not allowed
        })),
      };
    } catch (error) {
      // No workflow configured
      return {
        currentState: po.status,
        availableActions: [],
      };
    }
  }

  @Post(':id/actions/:actionLabel')
  async executeAction(
    @Param('id') id: string,
    @Param('actionLabel') actionLabel: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const user = this.extractUser(req);
    const po = await this.poService.getPurchaseOrder(id);

    try {
      const instance = await this.workflowService.executeTransition(
        'PurchaseOrder',
        id,
        actionLabel,
        user,
        po, // Pass full document for condition evaluation and GL posting
        body.comments,
      );

      return {
        success: true,
        newState: instance.currentStateLabel,
        message: `PO moved to ${instance.currentStateLabel}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

---

### Pattern 4: Listen to Workflow Events

React to workflow state changes in your module.

```typescript
// purchase-order.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../shared/services/email.service';

@Injectable()
export class PurchaseOrderListener {
  private readonly logger = new Logger(PurchaseOrderListener.name);

  constructor(private emailService: EmailService) {}

  /**
   * Listen for PO approval
   */
  @OnEvent('workflow.transition')
  async handleWorkflowTransition(event: any) {
    if (event.docType !== 'PurchaseOrder') return;

    this.logger.debug(`PO workflow transition: ${event.docId} → ${event.newState}`);

    // When PO is approved, send notification to vendor
    if (event.toState === 'approved') {
      try {
        const po = await this.getPoDetails(event.docId);
        await this.emailService.sendToVendor(po.vendorEmail, {
          subject: `Purchase Order ${po.poNumber} Approved`,
          body: `Your PO has been approved and will be sent shortly. Details: Amount $${po.totalAmount}`,
        });
      } catch (error) {
        this.logger.error(`Failed to notify vendor: ${error.message}`);
      }
    }

    // When PO is rejected, notify requester
    if (event.toState === 'rejected') {
      try {
        const po = await this.getPoDetails(event.docId);
        await this.emailService.sendToUser(po.createdBy, {
          subject: `Purchase Order ${po.poNumber} Rejected`,
          body: `Your PO was rejected. Please review and resubmit if needed.`,
        });
      } catch (error) {
        this.logger.error(`Failed to notify requester: ${error.message}`);
      }
    }
  }

  /**
   * Listen for PO completion
   */
  @OnEvent('workflow.completed')
  async handleWorkflowCompleted(event: any) {
    if (event.docType !== 'PurchaseOrder') return;

    this.logger.log(`PO workflow completed: ${event.docId} → ${event.finalState}`);

    // Archive PO to cold storage
    // Update related purchase orders statistics
    // Trigger next workflow step (e.g., goods receipt)
  }

  private async getPoDetails(poId: string) {
    // Fetch PO from database
    return {};
  }
}
```

---

## API Patterns

### Get Current Workflow Status
```bash
GET /workflows/PurchaseOrder/{po-id}/status
```

**Response:**
```json
{
  "docType": "PurchaseOrder",
  "docId": "po-12345",
  "currentStateId": "draft",
  "currentStateLabel": "Draft",
  "availableTransitions": [
    {
      "id": "submit",
      "label": "Submit for Approval",
      "allowed": true
    }
  ],
  "createdAt": "2026-08-11T10:00:00Z"
}
```

---

### Execute Workflow Transition
```bash
POST /workflows/PurchaseOrder/{po-id}/transition
Content-Type: application/json
Authorization: Bearer {token}

{
  "transitionLabel": "Submit for Approval",
  "comments": "Ready for review"
}
```

**Response:**
```json
{
  "newStateId": "pending_manager_approval",
  "newStateLabel": "Awaiting Manager Approval",
  "transitionExecutedAt": "2026-08-11T10:15:00Z",
  "conditionsEvaluated": [
    {
      "conditionId": "has_line_items",
      "description": "count: lineItems",
      "result": true
    }
  ],
  "actionsExecuted": [
    {
      "actionId": "notify_manager",
      "type": "send_notification",
      "status": "success"
    }
  ]
}
```

---

### Get Approval History
```bash
GET /workflows/PurchaseOrder/{po-id}/history
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "apr-001",
    "fromStateLabel": "Draft",
    "toStateLabel": "Awaiting Manager Approval",
    "transitionLabel": "Submit for Approval",
    "approvedBy": "user@company.com",
    "approvedAt": "2026-08-11T10:15:00Z",
    "comments": "Ready for review",
    "conditionsEvaluated": [...],
    "actionsExecuted": [...]
  },
  {
    "id": "apr-002",
    "fromStateLabel": "Awaiting Manager Approval",
    "toStateLabel": "Approved",
    "transitionLabel": "Approve",
    "approvedBy": "manager@company.com",
    "approvedAt": "2026-08-11T11:30:00Z",
    "comments": "Approved per policy"
  }
]
```

---

## Frontend Integration

### Show Workflow Status
```tsx
function PurchaseOrderDetail({ poId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const response = await fetch(`/api/workflows/PurchaseOrder/${poId}/status`);
      setStatus(await response.json());
    };
    fetchStatus();
  }, [poId]);

  return (
    <div>
      <h2>Status: {status?.currentStateLabel}</h2>
      <div className="actions">
        {status?.availableTransitions.map((t) => (
          <button
            key={t.id}
            disabled={!t.allowed}
            onClick={() => executeTransition(t.label)}
          >
            {t.label}
            {!t.allowed && <span> ({t.reason})</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Show Approval History
```tsx
function ApprovalHistory({ poId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const response = await fetch(`/api/workflows/PurchaseOrder/${poId}/history`);
      setHistory(await response.json());
    };
    fetchHistory();
  }, [poId]);

  return (
    <div className="timeline">
      {history.map((record) => (
        <div key={record.id} className="timeline-item">
          <div className="timestamp">{new Date(record.approvedAt).toLocaleString()}</div>
          <div className="action">{record.transitionLabel}</div>
          <div className="approver">By {record.approvedBy}</div>
          {record.comments && <div className="comments">{record.comments}</div>}
        </div>
      ))}
    </div>
  );
}
```

---

## Common Workflows

### Purchase Order Approval (Included)
- Draft → Pending Manager → Approved (with GL posting)
- Large amounts escalate to CFO
- Rejection handling

To activate:
```bash
npm run db:seed
```

### Leave Request
Coming soon in Phase 2

### Invoice Approval (3-Way Match)
Coming soon in Phase 2

---

## Error Handling

### Condition Failures
When a condition is not met, the transition is blocked:

```json
{
  "statusCode": 400,
  "message": "Conditions not met: PO must have at least 1 line item",
  "error": "Bad Request"
}
```

### Authorization Failures
When user lacks permission:

```json
{
  "statusCode": 403,
  "message": "Only manager can approve this transition",
  "error": "Forbidden"
}
```

### Action Failures
When an action (GL posting, notification) fails:

```json
{
  "statusCode": 400,
  "message": "Action \"post_gl\" failed: GL account 1300 not found",
  "error": "Bad Request"
}
```

---

## Testing

### Unit Test Example
```typescript
describe('PurchaseOrderService with Workflow', () => {
  it('should initialize workflow on PO creation', async () => {
    const po = await service.createPurchaseOrder(dto, user);

    const instance = await workflowService.getWorkflowInstance(
      'PurchaseOrder',
      po.id,
      user.tenantId,
    );

    expect(instance.currentStateId).toBe('draft');
  });

  it('should prevent edit when state does not allow', async () => {
    // Create PO in 'approved' state
    // Try to update it
    // Expect ForbiddenException
  });
});
```

---

## Troubleshooting

### "No active workflow for PurchaseOrder"
- The workflow definition hasn't been activated
- Run: `npm run db:seed`

### "GL account not found"
- GL account doesn't exist
- Create it: `POST /finance/accounts`

### Notification not sent
- Notification service not configured
- Check `NotificationService` logs

### Workflow not initialized
- Catch the error in service and log warning
- Backward compatibility: document works without workflow

---

## Next Steps

1. ✅ **Review this guide** — Understand integration patterns
2. ✅ **Run database seed** — Activate PO workflow
3. ✅ **Test via API** — Create PO, check status, execute transition
4. ✅ **Integrate with your module** — Follow the patterns above
5. ✅ **Create listeners** — React to workflow events
6. ⏳ **Create workflows for other docs** — LeaveRequest, Invoice, etc.

