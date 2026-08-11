import { PrismaClient } from '@prisma/client';

export async function seedPoWorkflow(prisma: PrismaClient) {
  const poWorkflowDefinition = {
    name: 'Purchase Order Approval',
    docType: 'PurchaseOrder',
    description: 'Standard PO approval workflow with manager and CFO approval based on amount',
    states: [
      {
        id: 'draft',
        name: 'Draft',
        label: 'Draft',
        description: 'Initial state, can be edited and deleted',
        allowEdit: true,
        allowDelete: true,
        allowTransition: true,
        postToGL: false,
        isTerminal: false,
      },
      {
        id: 'pending_manager_approval',
        name: 'Pending Manager Approval',
        label: 'Awaiting Manager Approval',
        description: 'Waiting for purchasing manager to review',
        allowEdit: false,
        allowDelete: false,
        allowTransition: false,
        postToGL: false,
        isTerminal: false,
      },
      {
        id: 'pending_cfo_approval',
        name: 'Pending CFO Approval',
        label: 'Awaiting CFO Approval',
        description: 'Large amounts require CFO sign-off',
        allowEdit: false,
        allowDelete: false,
        allowTransition: false,
        postToGL: false,
        isTerminal: false,
      },
      {
        id: 'approved',
        name: 'Approved',
        label: 'Approved',
        description: 'PO has been fully approved, GL entries will be posted',
        allowEdit: false,
        allowDelete: false,
        allowTransition: true,
        postToGL: true, // GL posts when entering this state
        isTerminal: false,
      },
      {
        id: 'rejected',
        name: 'Rejected',
        label: 'Rejected',
        description: 'PO was rejected and cannot proceed',
        allowEdit: false,
        allowDelete: false,
        allowTransition: false,
        postToGL: false,
        isTerminal: true,
      },
    ],
    transitions: [
      {
        id: 'submit_for_approval',
        fromState: 'draft',
        toState: 'pending_manager_approval',
        label: 'Submit for Approval',
        allowedRoles: ['purchasing_manager', 'procurement_lead'],
        conditions: [
          {
            id: 'has_line_items',
            type: 'count',
            field: 'lineItems',
            operator: 'gte',
            value: 1,
            errorMessage: 'PO must have at least 1 line item',
          },
          {
            id: 'has_vendor',
            type: 'field_value',
            field: 'vendorId',
            operator: 'neq',
            value: null,
            errorMessage: 'Vendor must be selected',
          },
        ],
        actions: [
          {
            id: 'notify_manager',
            type: 'send_notification',
            config: {
              to: '{{vendorId}}',
              subject: 'Purchase Order {{poNumber}} Submitted for Approval',
              body: `PO {{poNumber}} for ${{totalAmount}} has been submitted for approval. It will be reviewed and approved shortly.`,
            },
            failureAction: 'log_warning',
          },
        ],
        requiresApproval: false,
      },
      {
        id: 'manager_approve_small',
        fromState: 'pending_manager_approval',
        toState: 'approved',
        label: 'Approve',
        allowedRoles: ['purchasing_manager', 'procurement_lead'],
        conditions: [
          {
            id: 'under_threshold',
            type: 'amount_threshold',
            field: 'totalAmount',
            operator: 'lte',
            value: 10000,
            errorMessage: 'PO over $10,000 requires CFO approval',
          },
        ],
        actions: [
          {
            id: 'post_gl_entry',
            type: 'post_gl',
            config: {
              glEntries: [
                {
                  account: '1300', // Inventory Asset
                  debit: '{{totalAmount}}',
                  credit: 0,
                  description: 'PO {{poNumber}} approved - inventory purchase',
                },
                {
                  account: '2000', // Accounts Payable
                  debit: 0,
                  credit: '{{totalAmount}}',
                  description: 'PO {{poNumber}} approved - vendor payable',
                },
              ],
            },
            failureAction: 'block_transition',
          },
          {
            id: 'emit_approval_event',
            type: 'trigger_event',
            config: {
              event: 'purchase_order.approved',
              payload: {
                poId: '{{docId}}',
                poNumber: '{{poNumber}}',
                amount: '{{totalAmount}}',
                vendorId: '{{vendorId}}',
                approvedBy: '{{approvedBy}}',
              },
            },
            failureAction: 'log_warning',
          },
        ],
        requiresApproval: false,
      },
      {
        id: 'manager_escalate_large',
        fromState: 'pending_manager_approval',
        toState: 'pending_cfo_approval',
        label: 'Escalate to CFO',
        allowedRoles: ['purchasing_manager', 'procurement_lead'],
        conditions: [
          {
            id: 'over_threshold',
            type: 'amount_threshold',
            field: 'totalAmount',
            operator: 'gt',
            value: 10000,
            errorMessage: 'This PO does not require CFO escalation',
          },
        ],
        actions: [
          {
            id: 'notify_cfo',
            type: 'send_notification',
            config: {
              to: 'cfo@company.com',
              subject: 'Large Purchase Order {{poNumber}} Requires Your Approval',
              body: `PO {{poNumber}} for ${{totalAmount}} from {{vendorId}} requires CFO approval. Please review and approve.`,
            },
            failureAction: 'log_warning',
          },
        ],
        requiresApproval: false,
      },
      {
        id: 'cfo_approve_large',
        fromState: 'pending_cfo_approval',
        toState: 'approved',
        label: 'Approve',
        allowedRoles: ['CFO', 'finance_director'],
        conditions: [],
        actions: [
          {
            id: 'post_gl_entry',
            type: 'post_gl',
            config: {
              glEntries: [
                {
                  account: '1300', // Inventory Asset
                  debit: '{{totalAmount}}',
                  credit: 0,
                  description: 'PO {{poNumber}} CFO-approved - large purchase',
                },
                {
                  account: '2000', // Accounts Payable
                  debit: 0,
                  credit: '{{totalAmount}}',
                  description: 'PO {{poNumber}} CFO-approved - vendor payable',
                },
              ],
            },
            failureAction: 'block_transition',
          },
          {
            id: 'emit_approval_event',
            type: 'trigger_event',
            config: {
              event: 'purchase_order.approved',
              payload: {
                poId: '{{docId}}',
                poNumber: '{{poNumber}}',
                amount: '{{totalAmount}}',
                vendorId: '{{vendorId}}',
                approvedBy: '{{approvedBy}}',
                requiresCFO: true,
              },
            },
            failureAction: 'log_warning',
          },
        ],
        requiresApproval: false,
      },
      {
        id: 'reject_from_manager',
        fromState: 'pending_manager_approval',
        toState: 'rejected',
        label: 'Reject',
        allowedRoles: ['purchasing_manager', 'procurement_lead'],
        conditions: [],
        actions: [
          {
            id: 'notify_rejection',
            type: 'send_notification',
            config: {
              to: '{{createdBy.email}}',
              subject: 'Purchase Order {{poNumber}} Rejected',
              body: `PO {{poNumber}} has been rejected. Please review the comments and resubmit if needed.\n\nComments: {{comments}}`,
            },
            failureAction: 'log_warning',
          },
        ],
        requiresApproval: false,
      },
      {
        id: 'reject_from_cfo',
        fromState: 'pending_cfo_approval',
        toState: 'rejected',
        label: 'Reject',
        allowedRoles: ['CFO', 'finance_director'],
        conditions: [],
        actions: [
          {
            id: 'notify_rejection',
            type: 'send_notification',
            config: {
              to: '{{createdBy.email}}',
              subject: 'Purchase Order {{poNumber}} Rejected by CFO',
              body: `PO {{poNumber}} was rejected by the CFO. Please address the concerns and resubmit.\n\nComments: {{comments}}`,
            },
            failureAction: 'log_warning',
          },
        ],
        requiresApproval: false,
      },
    ],
  };

  const existing = await prisma.workflowDefinition.findFirst({
    where: {
      docType: 'PurchaseOrder',
      tenantId: 'default-tenant-id',
    },
  });

  if (!existing) {
    const workflow = await prisma.workflowDefinition.create({
      data: {
        tenantId: 'default-tenant-id',
        name: poWorkflowDefinition.name,
        description: poWorkflowDefinition.description,
        docType: poWorkflowDefinition.docType,
        isActive: true, // Automatically active
        definition: poWorkflowDefinition as any,
        createdBy: 'seed',
        activatedBy: 'seed',
        activatedAt: new Date(),
      },
    });

    console.log(`✅ PO Workflow created: ${workflow.id}`);
  } else {
    console.log(`⏭️  PO Workflow already exists`);
  }
}
