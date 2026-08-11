-- ============================================================================
-- Workflow Engine Tables
-- Created: 2026-08-11
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. WORKFLOW_DEFINITIONS
-- ============================================================================
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  doc_type VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  definition JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP,
  updated_by VARCHAR(255),
  activated_at TIMESTAMP,
  activated_by VARCHAR(255),

  -- Constraints
  UNIQUE(tenant_id, doc_type) WHERE is_active = true
);

CREATE INDEX idx_workflow_tenant_doctype ON workflow_definitions(tenant_id, doc_type);
CREATE INDEX idx_workflow_active ON workflow_definitions(is_active);
CREATE INDEX idx_workflow_created_at ON workflow_definitions(created_at DESC);

-- ============================================================================
-- 2. WORKFLOW_DEFINITION_VERSIONS
-- ============================================================================
CREATE TABLE workflow_definition_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,
  version_number INT NOT NULL,
  definition JSONB NOT NULL,
  change_reason VARCHAR(500),
  change_summary VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL,

  -- Constraints
  UNIQUE(workflow_definition_id, version_number)
);

CREATE INDEX idx_version_workflow ON workflow_definition_versions(workflow_definition_id);
CREATE INDEX idx_version_created_at ON workflow_definition_versions(created_at DESC);

-- ============================================================================
-- 3. WORKFLOW_INSTANCES
-- ============================================================================
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
  doc_type VARCHAR(100) NOT NULL,
  doc_id VARCHAR(255) NOT NULL,
  current_state_id VARCHAR(100) NOT NULL,
  current_state_label VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(tenant_id, doc_type, doc_id)
);

CREATE INDEX idx_instance_tenant_doctype ON workflow_instances(tenant_id, doc_type);
CREATE INDEX idx_instance_docid ON workflow_instances(doc_id);
CREATE INDEX idx_instance_state ON workflow_instances(current_state_id);
CREATE INDEX idx_instance_created_at ON workflow_instances(created_at DESC);

-- ============================================================================
-- 4. WORKFLOW_APPROVAL_HISTORY
-- ============================================================================
CREATE TABLE workflow_approval_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,
  from_state_id VARCHAR(100) NOT NULL,
  from_state_label VARCHAR(255),
  to_state_id VARCHAR(100) NOT NULL,
  to_state_label VARCHAR(255),
  transition_id VARCHAR(100) NOT NULL,
  transition_label VARCHAR(255),
  approved_by VARCHAR(255) NOT NULL,
  approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comments TEXT,
  conditions_evaluated JSONB,
  actions_executed JSONB,
  document_state_snapshot JSONB
);

CREATE INDEX idx_approval_instance ON workflow_approval_history(workflow_instance_id);
CREATE INDEX idx_approval_tenant ON workflow_approval_history(tenant_id);
CREATE INDEX idx_approval_date ON workflow_approval_history(approved_at DESC);
CREATE INDEX idx_approval_approver ON workflow_approval_history(approved_by);
CREATE INDEX idx_approval_from_to_state ON workflow_approval_history(from_state_id, to_state_id);

-- ============================================================================
-- 5. WORKFLOW_PENDING_APPROVALS
-- ============================================================================
CREATE TABLE workflow_pending_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  doc_type VARCHAR(100) NOT NULL,
  doc_id VARCHAR(255) NOT NULL,
  pending_approver_role VARCHAR(100),
  pending_approver_user_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP,
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMP,
  awaiting_transition_id VARCHAR(100),
  awaiting_transition_label VARCHAR(255)
);

CREATE INDEX idx_pending_tenant_approver ON workflow_pending_approvals(tenant_id, pending_approver_user_id);
CREATE INDEX idx_pending_role ON workflow_pending_approvals(pending_approver_role);
CREATE INDEX idx_pending_created_at ON workflow_pending_approvals(created_at DESC);
CREATE INDEX idx_pending_due_date ON workflow_pending_approvals(due_date ASC);
CREATE INDEX idx_pending_escalated ON workflow_pending_approvals(escalated);

-- ============================================================================
-- 6. WORKFLOW_ERROR_LOG
-- ============================================================================
CREATE TABLE workflow_error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  approval_history_id UUID REFERENCES workflow_approval_history(id) ON DELETE SET NULL,
  action_type VARCHAR(50),
  action_id VARCHAR(255),
  error_message TEXT NOT NULL,
  error_code VARCHAR(100),
  error_stack_trace TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMP,
  status VARCHAR(50),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_error_tenant ON workflow_error_log(tenant_id);
CREATE INDEX idx_error_workflow_instance ON workflow_error_log(workflow_instance_id);
CREATE INDEX idx_error_status ON workflow_error_log(status);
CREATE INDEX idx_error_created_at ON workflow_error_log(created_at DESC);
CREATE INDEX idx_error_retry_at ON workflow_error_log(next_retry_at ASC) WHERE status IN ('pending', 'retrying');

-- ============================================================================
-- 7. WORKFLOW_METRICS
-- ============================================================================
CREATE TABLE workflow_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  doc_type VARCHAR(100),
  period_date DATE NOT NULL,
  instances_created INT DEFAULT 0,
  instances_approved INT DEFAULT 0,
  instances_rejected INT DEFAULT 0,
  instances_escalated INT DEFAULT 0,
  avg_approval_time_hours DECIMAL(10, 2),
  max_approval_time_hours DECIMAL(10, 2),
  sla_violations INT DEFAULT 0,
  action_errors INT DEFAULT 0,
  transition_errors INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(tenant_id, workflow_definition_id, period_date)
);

CREATE INDEX idx_metric_tenant_doctype ON workflow_metrics(tenant_id, doc_type);
CREATE INDEX idx_metric_period ON workflow_metrics(period_date DESC);

-- ============================================================================
-- 8. WORKFLOW_AUDIT_LOG
-- ============================================================================
CREATE TABLE workflow_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  action VARCHAR(50),
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  user_id VARCHAR(255) NOT NULL,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_tenant ON workflow_audit_log(tenant_id);
CREATE INDEX idx_audit_action ON workflow_audit_log(action);
CREATE INDEX idx_audit_user ON workflow_audit_log(user_id);
CREATE INDEX idx_audit_date ON workflow_audit_log(created_at DESC);
CREATE INDEX idx_audit_resource ON workflow_audit_log(resource_type, resource_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Current state of all workflow instances
CREATE OR REPLACE VIEW v_workflow_current_state AS
SELECT
  wi.id,
  wi.tenant_id,
  wi.doc_type,
  wi.doc_id,
  wd.name AS workflow_name,
  wi.current_state_id,
  wi.current_state_label,
  wi.created_at,
  wi.created_by,
  wi.updated_at,
  COUNT(wah.id) AS total_approvals
FROM workflow_instances wi
LEFT JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
LEFT JOIN workflow_approval_history wah ON wi.id = wah.workflow_instance_id
GROUP BY wi.id, wd.name;

-- Approval inbox for each user
CREATE OR REPLACE VIEW v_approval_inbox AS
SELECT
  wpa.id,
  wpa.tenant_id,
  wpa.doc_type,
  wpa.doc_id,
  wpa.pending_approver_user_id,
  wpa.pending_approver_role,
  wpa.awaiting_transition_label,
  wpa.created_at,
  wpa.due_date,
  CASE
    WHEN NOW() > wpa.due_date AND wpa.due_date IS NOT NULL THEN 'overdue'
    WHEN NOW() > (wpa.due_date - INTERVAL '1 day') AND wpa.due_date IS NOT NULL THEN 'due_soon'
    ELSE 'on_track'
  END AS urgency,
  wi.created_by AS document_creator,
  wi.created_at AS document_created_at
FROM workflow_pending_approvals wpa
JOIN workflow_instances wi ON wpa.workflow_instance_id = wi.id
WHERE wpa.escalated = false
ORDER BY wpa.due_date ASC NULLS LAST;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update workflow_instances.updated_at
CREATE OR REPLACE FUNCTION update_workflow_instance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workflow_instances
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.workflow_instance_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_instance_timestamp
AFTER INSERT ON workflow_approval_history
FOR EACH ROW
EXECUTE FUNCTION update_workflow_instance_timestamp();

-- ============================================================================
