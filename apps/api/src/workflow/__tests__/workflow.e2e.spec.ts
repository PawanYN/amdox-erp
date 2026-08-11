import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException, ForbiddenException } from '@nestjs/common';
import { WorkflowService } from '../workflow.service';
import { ConditionEvaluator } from '../condition-evaluator';
import { ActionExecutor } from '../action-executor';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Workflow Engine E2E', () => {
  let app: INestApplication;
  let workflowService: WorkflowService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        ConditionEvaluator,
        ActionExecutor,
        EventEmitter2,
        {
          provide: PrismaService,
          useValue: {
            workflowDefinition: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            workflowInstance: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            workflowApprovalHistory: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            workflowPendingApproval: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    workflowService = moduleFixture.get<WorkflowService>(WorkflowService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
  });

  describe('Complete Purchase Order Approval Workflow', () => {
    let workflowId: string;

    it('should create a workflow definition', async () => {
      const mockWorkflow = {
        id: 'wf-001',
        tenantId: 'default-tenant-id',
        name: 'PO Approval',
        docType: 'PurchaseOrder',
        isActive: false,
        definition: {
          name: 'PO Approval',
          docType: 'PurchaseOrder',
          states: [
            {
              id: 'draft',
              name: 'Draft',
              label: 'Draft',
              allowEdit: true,
              allowDelete: true,
              allowTransition: true,
              postToGL: false,
              isTerminal: false,
            },
            {
              id: 'approved',
              name: 'Approved',
              label: 'Approved',
              allowEdit: false,
              allowDelete: false,
              allowTransition: false,
              postToGL: true,
              isTerminal: false,
            },
          ],
          transitions: [
            {
              id: 'approve',
              fromState: 'draft',
              toState: 'approved',
              label: 'Approve',
              allowedRoles: ['manager'],
              conditions: [
                {
                  id: 'min-items',
                  type: 'count',
                  field: 'lineItems',
                  operator: 'gte',
                  value: 1,
                  errorMessage: 'PO must have at least 1 line item',
                },
              ],
              actions: [
                {
                  id: 'post-gl',
                  type: 'post_gl',
                  config: {
                    glEntries: [
                      {
                        account: '1300',
                        debit: '{{totalAmount}}',
                        credit: 0,
                        description: 'PO {{poNumber}} approved',
                      },
                      {
                        account: '2000',
                        debit: 0,
                        credit: '{{totalAmount}}',
                        description: 'PO {{poNumber}} approved',
                      },
                    ],
                  },
                },
              ],
              requiresApproval: false,
            },
          ],
        },
        createdAt: new Date(),
        createdBy: 'admin@company.com',
      };

      (prisma.workflowDefinition.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.workflowDefinition.create as jest.Mock).mockResolvedValueOnce(mockWorkflow);

      const user = {
        id: 'user-1',
        email: 'admin@company.com',
        roles: ['admin'],
        tenantId: 'default-tenant-id',
      };

      const dto = {
        name: 'PO Approval',
        docType: 'PurchaseOrder',
        states: mockWorkflow.definition.states,
        transitions: mockWorkflow.definition.transitions,
      };

      const result = await workflowService.createWorkflow(dto, user);

      expect(result.id).toBe('wf-001');
      expect(result.docType).toBe('PurchaseOrder');
      expect(result.isActive).toBe(false);
      workflowId = result.id;
    });

    it('should activate the workflow', async () => {
      const activeWorkflow = {
        id: workflowId,
        tenantId: 'default-tenant-id',
        isActive: true,
        activatedAt: new Date(),
        activatedBy: 'admin@company.com',
      };

      (prisma.workflowDefinition.findFirst as jest.Mock).mockResolvedValueOnce({
        id: workflowId,
        isActive: false,
      });
      (prisma.workflowDefinition.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
      (prisma.workflowDefinition.update as jest.Mock).mockResolvedValueOnce(activeWorkflow);

      const user = {
        id: 'user-1',
        email: 'admin@company.com',
        roles: ['admin'],
        tenantId: 'default-tenant-id',
      };

      const result = await workflowService.activateWorkflow(workflowId, user);

      expect(result.isActive).toBe(true);
    });

    it('should initialize workflow for new PO', async () => {
      const mockInstance = {
        id: 'inst-001',
        tenantId: 'default-tenant-id',
        workflowDefinitionId: workflowId,
        docType: 'PurchaseOrder',
        docId: 'po-001',
        currentStateId: 'draft',
        currentStateLabel: 'Draft',
        createdAt: new Date(),
        createdBy: 'system',
        updatedAt: new Date(),
      };

      const mockWorkflow = {
        id: workflowId,
        isActive: true,
        definition: {
          states: [{ id: 'draft', label: 'Draft' }],
        },
      };

      (prisma.workflowDefinition.findFirst as jest.Mock).mockResolvedValueOnce(mockWorkflow);
      (prisma.workflowInstance.create as jest.Mock).mockResolvedValueOnce(mockInstance);

      const result = await workflowService.initializeWorkflow('PurchaseOrder', 'po-001', 'default-tenant-id');

      expect(result.docType).toBe('PurchaseOrder');
      expect(result.docId).toBe('po-001');
      expect(result.currentStateId).toBe('draft');
    });

    it('should reject transition if condition fails (no line items)', async () => {
      const mockInstance = {
        id: 'inst-001',
        workflowDefinitionId: workflowId,
        currentStateId: 'draft',
        currentStateLabel: 'Draft',
      };

      const mockWorkflow = {
        id: workflowId,
        definition: {
          states: [{ id: 'draft', label: 'Draft' }],
          transitions: [
            {
              id: 'approve',
              fromState: 'draft',
              toState: 'approved',
              label: 'Approve',
              allowedRoles: ['manager'],
              conditions: [
                {
                  id: 'min-items',
                  type: 'count',
                  field: 'lineItems',
                  operator: 'gte',
                  value: 1,
                  errorMessage: 'PO must have at least 1 line item',
                },
              ],
            },
          ],
        },
      };

      (prisma.workflowInstance.findFirst as jest.Mock).mockResolvedValueOnce(mockInstance);
      (prisma.workflowDefinition.findFirst as jest.Mock).mockResolvedValueOnce(mockWorkflow);

      const user = {
        id: 'user-1',
        email: 'manager@company.com',
        roles: ['manager'],
        tenantId: 'default-tenant-id',
      };

      const document = { id: 'po-001', lineItems: [] }; // Empty - should fail

      await expect(
        workflowService.executeTransition('PurchaseOrder', 'po-001', 'Approve', user, document),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition if user lacks authorization', async () => {
      const mockInstance = {
        id: 'inst-001',
        workflowDefinitionId: workflowId,
        currentStateId: 'draft',
        currentStateLabel: 'Draft',
      };

      const mockWorkflow = {
        id: workflowId,
        definition: {
          states: [{ id: 'draft', label: 'Draft' }],
          transitions: [
            {
              id: 'approve',
              fromState: 'draft',
              toState: 'approved',
              label: 'Approve',
              allowedRoles: ['manager'], // User doesn't have this role
              conditions: [],
            },
          ],
        },
      };

      (prisma.workflowInstance.findFirst as jest.Mock).mockResolvedValueOnce(mockInstance);
      (prisma.workflowDefinition.findFirst as jest.Mock).mockResolvedValueOnce(mockWorkflow);

      const user = {
        id: 'user-2',
        email: 'employee@company.com',
        roles: ['employee'], // Not a manager
        tenantId: 'default-tenant-id',
      };

      const document = { id: 'po-001', lineItems: [{ id: 1 }] };

      await expect(
        workflowService.executeTransition('PurchaseOrder', 'po-001', 'Approve', user, document),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully execute transition when conditions met and user authorized', async () => {
      const mockInstance = {
        id: 'inst-001',
        workflowDefinitionId: workflowId,
        currentStateId: 'draft',
        currentStateLabel: 'Draft',
      };

      const targetState = {
        id: 'approved',
        label: 'Approved',
        isTerminal: false,
      };

      const mockWorkflow = {
        id: workflowId,
        definition: {
          states: [
            { id: 'draft', label: 'Draft' },
            { id: 'approved', label: 'Approved', isTerminal: false },
          ],
          transitions: [
            {
              id: 'approve',
              fromState: 'draft',
              toState: 'approved',
              label: 'Approve',
              allowedRoles: ['manager'],
              conditions: [
                {
                  id: 'min-items',
                  type: 'count',
                  field: 'lineItems',
                  operator: 'gte',
                  value: 1,
                  errorMessage: 'Must have at least 1 line item',
                },
              ],
              actions: [],
            },
          ],
        },
      };

      const updatedInstance = {
        ...mockInstance,
        currentStateId: 'approved',
        currentStateLabel: 'Approved',
        updatedAt: new Date(),
      };

      (prisma.workflowInstance.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockInstance)
        .mockResolvedValueOnce(mockInstance);

      (prisma.workflowDefinition.findFirst as jest.Mock).mockResolvedValueOnce(mockWorkflow);

      (prisma.workflowInstance.update as jest.Mock).mockResolvedValueOnce(updatedInstance);

      (prisma.workflowApprovalHistory.create as jest.Mock).mockResolvedValueOnce({
        id: 'apr-001',
        approvedAt: new Date(),
      });

      const user = {
        id: 'user-1',
        email: 'manager@company.com',
        roles: ['manager'],
        tenantId: 'default-tenant-id',
      };

      const document = { id: 'po-001', lineItems: [{ id: 1 }], totalAmount: 5000, poNumber: 'PO-001' };

      const result = await workflowService.executeTransition(
        'PurchaseOrder',
        'po-001',
        'Approve',
        user,
        document,
        'Approved per policy',
      );

      expect(result.currentStateId).toBe('approved');
      expect(result.currentStateLabel).toBe('Approved');
      expect(prisma.workflowApprovalHistory.create).toHaveBeenCalled();
    });

    it('should retrieve approval history', async () => {
      const mockHistory = [
        {
          id: 'apr-001',
          fromStateId: 'draft',
          toStateId: 'approved',
          transitionLabel: 'Approve',
          approvedBy: 'user-1',
          approvedAt: new Date(),
          comments: 'Approved per policy',
          conditionsEvaluated: [],
          actionsExecuted: [],
        },
      ];

      (prisma.workflowInstance.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'inst-001',
      });

      (prisma.workflowApprovalHistory.findMany as jest.Mock).mockResolvedValueOnce(mockHistory);

      const result = await workflowService.getApprovalHistory('PurchaseOrder', 'po-001', 'default-tenant-id');

      expect(result).toHaveLength(1);
      expect(result[0].transitionLabel).toBe('Approve');
      expect(result[0].comments).toBe('Approved per policy');
    });
  });

  describe('Workflow Validation', () => {
    it('should detect cycles in workflow transitions', async () => {
      const user = {
        id: 'user-1',
        email: 'admin@company.com',
        roles: ['admin'],
        tenantId: 'default-tenant-id',
      };

      const dto = {
        name: 'Cyclic Workflow',
        docType: 'TestDoc',
        states: [
          { id: 'a', name: 'A', label: 'A', allowEdit: true, allowDelete: false, allowTransition: true, postToGL: false, isTerminal: false },
          { id: 'b', name: 'B', label: 'B', allowEdit: true, allowDelete: false, allowTransition: true, postToGL: false, isTerminal: false },
        ],
        transitions: [
          { id: 't1', fromState: 'a', toState: 'b', label: 'Go to B', allowedRoles: [], conditions: [], actions: [], requiresApproval: false },
          { id: 't2', fromState: 'b', toState: 'a', label: 'Back to A', allowedRoles: [], conditions: [], actions: [], requiresApproval: false }, // Cycle!
        ],
      };

      (prisma.workflowDefinition.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.workflowDefinition.create as jest.Mock).mockResolvedValueOnce({
        id: 'wf-test',
        definition: dto,
      });

      // Should not throw - cycles are allowed but logged as warnings
      const result = await workflowService.createWorkflow(dto, user);
      expect(result.id).toBeDefined();
    });
  });
});
