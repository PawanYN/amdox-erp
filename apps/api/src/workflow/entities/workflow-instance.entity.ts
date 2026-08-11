export interface ConditionEvalResult {
  conditionId: string;
  description: string;
  result: boolean;
  errorMessage?: string;
}

export interface ActionExecutionResult {
  actionId: string;
  type: string;
  status: 'success' | 'failure' | 'skipped';
  result?: any;
  error?: string;
}

export class ApprovalRecord {
  id: string;
  workflowInstanceId: string;
  tenantId: string;
  fromStateId: string;
  fromStateLabel: string;
  toStateId: string;
  toStateLabel: string;
  transitionId: string;
  transitionLabel: string;
  approvedBy: string;
  approvedAt: Date;
  comments?: string;
  conditionsEvaluated?: ConditionEvalResult[];
  actionsExecuted?: ActionExecutionResult[];
  documentStateSnapshot?: any;
}

export class WorkflowInstance {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  docType: string;
  docId: string;
  currentStateId: string;
  currentStateLabel: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface AvailableTransition {
  id: string;
  label: string;
  allowed: boolean;
  reason?: string;
}

export interface WorkflowStatus {
  docType: string;
  docId: string;
  currentStateId: string;
  currentStateLabel: string;
  availableTransitions: AvailableTransition[];
  createdAt: Date;
  createdBy: string;
}

export class WorkflowPendingApproval {
  id: string;
  tenantId: string;
  workflowInstanceId: string;
  docType: string;
  docId: string;
  pendingApproverRole?: string;
  pendingApproverUserId?: string;
  createdAt: Date;
  dueDate?: Date;
  escalated: boolean;
  escalatedAt?: Date;
  awaitingTransitionId: string;
  awaitingTransitionLabel: string;
}

export class WorkflowErrorLog {
  id: string;
  tenantId: string;
  workflowInstanceId: string;
  approvalHistoryId?: string;
  actionType: string;
  actionId: string;
  errorMessage: string;
  errorCode?: string;
  errorStackTrace?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  status: 'pending' | 'retrying' | 'failed' | 'manual_review';
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
