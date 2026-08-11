import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ConditionEvaluator } from './condition-evaluator';
import { ActionExecutor } from './action-executor';
import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
  WorkflowAction,
  WorkflowCondition,
} from './entities/workflow-definition.entity';
import {
  WorkflowInstance,
  WorkflowStatus,
  AvailableTransition,
  ApprovalRecord,
  ConditionEvalResult,
  ActionExecutionResult,
} from './entities/workflow-instance.entity';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/create-workflow.dto';

interface User {
  id: string;
  email: string;
  roles: string[];
  tenantId: string;
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private conditionEvaluator: ConditionEvaluator,
    private actionExecutor: ActionExecutor,
    private eventEmitter: EventEmitter2,
  ) {}

  // ========================================================================
  // WORKFLOW DEFINITION CRUD
  // ========================================================================

  async createWorkflow(dto: CreateWorkflowDto, user: User): Promise<WorkflowDefinition> {
    // Check if active workflow already exists for this docType
    const existing = await this.prisma.workflowDefinition.findFirst({
      where: {
        tenantId: user.tenantId,
        docType: dto.docType,
        isActive: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Active workflow already exists for ${dto.docType}. Deactivate it first.`,
      );
    }

    // Validate workflow structure
    this.validateWorkflowDefinition(dto);

    const definition = {
      name: dto.name,
      description: dto.description,
      docType: dto.docType,
      states: dto.states,
      transitions: dto.transitions,
    };

    const workflow = await this.prisma.workflowDefinition.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        description: dto.description,
        docType: dto.docType,
        isActive: false,
        definition,
        createdBy: user.id,
      },
    });

    this.logger.log(`Workflow created: ${workflow.id} (${dto.docType})`);
    this.eventEmitter.emit('workflow.definition.created', { workflowId: workflow.id });

    return this.mapWorkflow(workflow);
  }

  async getWorkflow(id: string, tenantId: string): Promise<WorkflowDefinition> {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }

    return this.mapWorkflow(workflow);
  }

  async getWorkflowByDocType(docType: string, tenantId: string): Promise<WorkflowDefinition> {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { docType, tenantId, isActive: true },
    });

    if (!workflow) {
      throw new NotFoundException(`No active workflow for ${docType}`);
    }

    return this.mapWorkflow(workflow);
  }

  async listWorkflows(tenantId: string): Promise<WorkflowDefinition[]> {
    const workflows = await this.prisma.workflowDefinition.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map((w) => this.mapWorkflow(w));
  }

  async updateWorkflow(id: string, dto: UpdateWorkflowDto, user: User): Promise<WorkflowDefinition> {
    const workflow = await this.getWorkflow(id, user.tenantId);

    if (workflow.isActive) {
      throw new BadRequestException('Cannot update active workflow. Deactivate first.');
    }

    const updated = await this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: dto.name ?? workflow.name,
        description: dto.description ?? workflow.description,
        definition: dto.states && dto.transitions ? { ...workflow.definition, ...dto } : undefined,
        updatedBy: user.id,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Workflow updated: ${id}`);
    return this.mapWorkflow(updated);
  }

  async activateWorkflow(id: string, user: User): Promise<WorkflowDefinition> {
    const workflow = await this.getWorkflow(id, user.tenantId);

    if (workflow.isActive) {
      throw new BadRequestException('Workflow already active');
    }

    // Deactivate any other active workflow for this docType
    await this.prisma.workflowDefinition.updateMany({
      where: {
        tenantId: user.tenantId,
        docType: workflow.docType,
        isActive: true,
      },
      data: { isActive: false },
    });

    const activated = await this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        isActive: true,
        activatedAt: new Date(),
        activatedBy: user.id,
      },
    });

    this.logger.log(`Workflow activated: ${id}`);
    this.eventEmitter.emit('workflow.definition.activated', { workflowId: id });

    return this.mapWorkflow(activated);
  }

  async deleteWorkflow(id: string, tenantId: string): Promise<void> {
    const workflow = await this.getWorkflow(id, tenantId);

    if (workflow.isActive) {
      throw new BadRequestException('Cannot delete active workflow');
    }

    await this.prisma.workflowDefinition.delete({ where: { id } });

    this.logger.log(`Workflow deleted: ${id}`);
  }

  // ========================================================================
  // WORKFLOW INSTANCE MANAGEMENT
  // ========================================================================

  async initializeWorkflow(docType: string, docId: string, tenantId: string): Promise<WorkflowInstance> {
    // Get active workflow for docType
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { docType, tenantId, isActive: true },
    });

    if (!workflow) {
      throw new BadRequestException(`No active workflow for ${docType}`);
    }

    const definition = workflow.definition as any;
    const initialState = definition.states[0];

    const instance = await this.prisma.workflowInstance.create({
      data: {
        tenantId,
        workflowDefinitionId: workflow.id,
        docType,
        docId,
        currentStateId: initialState.id,
        currentStateLabel: initialState.label,
        createdBy: 'system',
      },
    });

    this.logger.debug(`Workflow initialized: ${docType}/${docId} → ${initialState.label}`);
    this.eventEmitter.emit('workflow.instance.created', { instanceId: instance.id, docType, docId });

    return this.mapInstance(instance);
  }

  async getWorkflowInstance(docType: string, docId: string, tenantId: string): Promise<WorkflowInstance> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { docType, docId, tenantId },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance not found for ${docType}/${docId}`);
    }

    return this.mapInstance(instance);
  }

  async getInstanceStatus(docType: string, docId: string, tenantId: string): Promise<WorkflowStatus> {
    const instance = await this.getWorkflowInstance(docType, docId, tenantId);
    const workflow = await this.getWorkflow(instance.workflowDefinitionId, tenantId);
    const availableTransitions = await this.getAvailableTransitions(instance, workflow, null);

    return {
      docType: instance.docType,
      docId: instance.docId,
      currentStateId: instance.currentStateId,
      currentStateLabel: instance.currentStateLabel,
      availableTransitions,
      createdAt: instance.createdAt,
      createdBy: instance.createdBy,
    };
  }

  // ========================================================================
  // TRANSITIONS & APPROVALS
  // ========================================================================

  async getAvailableTransitions(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    user: User | null,
  ): Promise<AvailableTransition[]> {
    const definition = workflow.definition as any;

    const transitions = definition.transitions.filter((t: WorkflowTransition) => t.fromState === instance.currentStateId);

    return transitions.map((t: WorkflowTransition) => {
      let allowed = true;
      let reason: string | undefined;

      // Check if user is authorized
      if (user && t.allowedRoles && t.allowedRoles.length > 0) {
        const hasRole = user.roles.some((role) => t.allowedRoles.includes(role));
        const isAllowedUser = t.allowedUsers?.includes(user.id);

        if (!hasRole && !isAllowedUser) {
          allowed = false;
          reason = `Requires roles: ${t.allowedRoles.join(', ')}`;
        }
      }

      return {
        id: t.id,
        label: t.label,
        allowed,
        reason,
      };
    });
  }

  async canExecuteTransition(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    transitionLabel: string,
    user: User,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const definition = workflow.definition as any;
    const transition = definition.transitions.find(
      (t: WorkflowTransition) => t.label === transitionLabel && t.fromState === instance.currentStateId,
    );

    if (!transition) {
      return { allowed: false, reason: 'Transition not available from current state' };
    }

    // Check authorization
    if (transition.allowedRoles && transition.allowedRoles.length > 0) {
      const hasRole = user.roles.some((role) => transition.allowedRoles.includes(role));
      const isAllowedUser = transition.allowedUsers?.includes(user.id);

      if (!hasRole && !isAllowedUser) {
        return { allowed: false, reason: `Requires roles: ${transition.allowedRoles.join(', ')}` };
      }
    }

    return { allowed: true };
  }

  async executeTransition(
    docType: string,
    docId: string,
    transitionLabel: string,
    user: User,
    document: any,
    comments?: string,
  ): Promise<WorkflowInstance> {
    this.logger.debug(`Transition requested: ${docType}/${docId} → "${transitionLabel}"`);

    // Get instance and workflow
    const instance = await this.getWorkflowInstance(docType, docId, user.tenantId);
    const workflow = await this.getWorkflow(instance.workflowDefinitionId, user.tenantId);
    const definition = workflow.definition as any;

    // Find transition
    const transition = definition.transitions.find(
      (t: WorkflowTransition) => t.label === transitionLabel && t.fromState === instance.currentStateId,
    );

    if (!transition) {
      throw new BadRequestException(
        `Transition "${transitionLabel}" not available from state "${instance.currentStateLabel}"`,
      );
    }

    // Check authorization
    const canExecute = await this.canExecuteTransition(instance, workflow, transitionLabel, user);
    if (!canExecute.allowed) {
      throw new ForbiddenException(canExecute.reason || 'Not authorized for this transition');
    }

    // Evaluate conditions
    const conditions = (transition.conditions || []) as WorkflowCondition[];
    const conditionResults = await this.conditionEvaluator.evaluateAll(conditions, document);
    const conditionsFailed = conditionResults.some((r: ConditionEvalResult) => !r.result);

    if (conditionsFailed) {
      const failedConditions = conditionResults.filter((r: ConditionEvalResult) => !r.result);
      throw new BadRequestException(
        `Conditions not met: ${failedConditions.map((c: ConditionEvalResult) => c.errorMessage).join('; ')}`,
      );
    }

    // Execute actions
    const targetState = definition.states.find((s: WorkflowState) => s.id === transition.toState);
    const actions = (transition.actions || []) as WorkflowAction[];
    const actionResults = await this.actionExecutor.executeAll(actions, document, {
      tenantId: user.tenantId,
      userId: user.id,
      docType,
      docId,
    });

    // Update instance state
    const updatedInstance = await this.prisma.workflowInstance.update({
      where: { id: instance.id },
      data: {
        currentStateId: transition.toState,
        currentStateLabel: targetState.label,
        updatedAt: new Date(),
      },
    });

    // Record approval history
    await this.prisma.workflowApprovalHistory.create({
      data: {
        workflowInstanceId: instance.id,
        tenantId: user.tenantId,
        fromStateId: instance.currentStateId,
        fromStateLabel: instance.currentStateLabel,
        toStateId: transition.toState,
        toStateLabel: targetState.label,
        transitionId: transition.id,
        transitionLabel: transition.label,
        approvedBy: user.id,
        approvedAt: new Date(),
        comments,
        conditionsEvaluated: conditionResults,
        actionsExecuted: actionResults,
        documentStateSnapshot: document,
      },
    });

    this.logger.log(
      `Transition executed: ${docType}/${docId} ${instance.currentStateLabel} → ${targetState.label} by ${user.email}`,
    );

    // Emit events
    this.eventEmitter.emit('workflow.transition', {
      docType,
      docId,
      fromState: instance.currentStateId,
      toState: transition.toState,
      transitionLabel: transition.label,
      approvedBy: user.id,
      approvedAt: new Date(),
    });

    if (targetState.isTerminal) {
      this.eventEmitter.emit('workflow.completed', { docType, docId, finalState: transition.toState });
    }

    return this.mapInstance(updatedInstance);
  }

  // ========================================================================
  // APPROVAL HISTORY
  // ========================================================================

  async getApprovalHistory(docType: string, docId: string, tenantId: string): Promise<ApprovalRecord[]> {
    const instance = await this.getWorkflowInstance(docType, docId, tenantId);

    const history = await this.prisma.workflowApprovalHistory.findMany({
      where: { workflowInstanceId: instance.id },
      orderBy: { approvedAt: 'asc' },
    });

    return history.map((h) => this.mapApprovalRecord(h));
  }

  async getApprovalInbox(tenantId: string, userId: string): Promise<ApprovalRecord[]> {
    const pending = await this.prisma.workflowPendingApproval.findMany({
      where: {
        tenantId,
        pendingApproverUserId: userId,
        escalated: false,
      },
      include: {
        workflowInstance: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Return pending approvals (simplified - full implementation would include more details)
    return [];
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private validateWorkflowDefinition(dto: CreateWorkflowDto | UpdateWorkflowDto): void {
    if (!dto.states || dto.states.length === 0) {
      throw new BadRequestException('Workflow must have at least one state');
    }

    if (!dto.transitions) {
      throw new BadRequestException('Workflow must have transitions');
    }

    // Check that all transitions reference valid states
    const stateIds = new Set((dto.states || []).map((s: WorkflowState) => s.id));

    for (const transition of dto.transitions || []) {
      if (!stateIds.has(transition.fromState)) {
        throw new BadRequestException(`Transition references unknown state: ${transition.fromState}`);
      }
      if (!stateIds.has(transition.toState)) {
        throw new BadRequestException(`Transition references unknown state: ${transition.toState}`);
      }
    }

    // Ensure no cycles (simple DAG check)
    const hasCycle = this.detectCycle(dto.transitions || [], stateIds);
    if (hasCycle) {
      this.logger.warn('Workflow contains cycles - state transitions may loop');
    }
  }

  private detectCycle(transitions: WorkflowTransition[], stateIds: Set<string>): boolean {
    // Simple cycle detection: if any state can reach itself through transitions
    const graph = new Map<string, Set<string>>();

    for (const state of stateIds) {
      graph.set(state, new Set());
    }

    for (const t of transitions) {
      graph.get(t.fromState)?.add(t.toState);
    }

    for (const startState of stateIds) {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      if (this.hasCycleDFS(startState, graph, visited, recursionStack)) {
        return true;
      }
    }

    return false;
  }

  private hasCycleDFS(node: string, graph: Map<string, Set<string>>, visited: Set<string>, stack: Set<string>): boolean {
    visited.add(node);
    stack.add(node);

    for (const neighbor of graph.get(node) || []) {
      if (!visited.has(neighbor)) {
        if (this.hasCycleDFS(neighbor, graph, visited, stack)) {
          return true;
        }
      } else if (stack.has(neighbor)) {
        return true;
      }
    }

    stack.delete(node);
    return false;
  }

  private mapWorkflow(raw: any): WorkflowDefinition {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      name: raw.name,
      description: raw.description,
      docType: raw.docType,
      isActive: raw.isActive,
      states: raw.definition.states,
      transitions: raw.definition.transitions,
      definition: raw.definition,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
      activatedAt: raw.activatedAt,
    };
  }

  private mapInstance(raw: any): WorkflowInstance {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      workflowDefinitionId: raw.workflowDefinitionId,
      docType: raw.docType,
      docId: raw.docId,
      currentStateId: raw.currentStateId,
      currentStateLabel: raw.currentStateLabel,
      createdAt: raw.createdAt,
      createdBy: raw.createdBy,
      updatedAt: raw.updatedAt,
    };
  }

  private mapApprovalRecord(raw: any): ApprovalRecord {
    return {
      id: raw.id,
      workflowInstanceId: raw.workflowInstanceId,
      tenantId: raw.tenantId,
      fromStateId: raw.fromStateId,
      fromStateLabel: raw.fromStateLabel,
      toStateId: raw.toStateId,
      toStateLabel: raw.toStateLabel,
      transitionId: raw.transitionId,
      transitionLabel: raw.transitionLabel,
      approvedBy: raw.approvedBy,
      approvedAt: raw.approvedAt,
      comments: raw.comments,
      conditionsEvaluated: raw.conditionsEvaluated,
      actionsExecuted: raw.actionsExecuted,
      documentStateSnapshot: raw.documentStateSnapshot,
    };
  }
}
