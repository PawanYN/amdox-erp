export interface WorkflowState {
  id: string;
  name: string;
  label: string;
  description?: string;
  allowEdit: boolean;
  allowDelete: boolean;
  allowTransition: boolean;
  postToGL: boolean;
  isTerminal: boolean;
}

export interface WorkflowCondition {
  id: string;
  type: 'field_value' | 'amount_threshold' | 'count' | 'expression';
  field?: string;
  operator: 'equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'neq';
  value?: any;
  expression?: string;
  errorMessage?: string;
}

export interface GLEntry {
  account: string;
  debit: string | number;
  credit: string | number;
  description: string;
}

export interface WorkflowAction {
  id: string;
  type: 'post_gl' | 'send_notification' | 'update_field' | 'trigger_event' | 'webhook' | 'snapshot';
  config: {
    glEntries?: GLEntry[];
    to?: string;
    subject?: string;
    body?: string;
    field?: string;
    value?: any;
    event?: string;
    payload?: any;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    fields?: string[];
  };
  failureAction?: 'block_transition' | 'log_warning';
}

export interface WorkflowTransition {
  id: string;
  fromState: string;
  toState: string;
  label: string;
  allowedRoles: string[];
  allowedUsers?: string[];
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
  requiresApproval: boolean;
  approvalMessage?: string;
}

export class WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  docType: string;
  isActive: boolean;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  definition: any; // Full JSONB config
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  activatedAt?: Date;
  activatedBy?: string;
}

export class WorkflowDefinitionVersion {
  id: string;
  workflowDefinitionId: string;
  tenantId: string;
  versionNumber: number;
  definition: any;
  changeSummary?: string;
  changeReason?: string;
  createdAt: Date;
  createdBy: string;
}
