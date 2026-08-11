import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/create-workflow.dto';
import { TransitionRequestDto, TransitionResponseDto } from './dto/transition-request.dto';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import {
  WorkflowInstance,
  WorkflowStatus,
  ApprovalRecord,
} from './entities/workflow-instance.entity';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    tenantId: string;
    roles: string[];
  };
}

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(private workflowService: WorkflowService) {}

  // ========================================================================
  // WORKFLOW DEFINITIONS
  // ========================================================================

  /**
   * Create a new workflow definition
   */
  @Post()
  async createWorkflow(
    @Body() dto: CreateWorkflowDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkflowDefinition> {
    const user = this.extractUser(req);
    this.logger.log(`Creating workflow: ${dto.docType} by ${user.email}`);
    return this.workflowService.createWorkflow(dto, user);
  }

  /**
   * List all workflow definitions for tenant
   */
  @Get()
  async listWorkflows(@Req() req: AuthenticatedRequest): Promise<WorkflowDefinition[]> {
    const user = this.extractUser(req);
    return this.workflowService.listWorkflows(user.tenantId);
  }

  /**
   * Get specific workflow definition
   */
  @Get(':id')
  async getWorkflow(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkflowDefinition> {
    const user = this.extractUser(req);
    return this.workflowService.getWorkflow(id, user.tenantId);
  }

  /**
   * Update workflow definition (only if not active)
   */
  @Put(':id')
  async updateWorkflow(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkflowDefinition> {
    const user = this.extractUser(req);
    this.logger.log(`Updating workflow: ${id} by ${user.email}`);
    return this.workflowService.updateWorkflow(id, dto, user);
  }

  /**
   * Activate workflow (deactivates any other active workflow for this docType)
   */
  @Post(':id/activate')
  async activateWorkflow(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkflowDefinition> {
    const user = this.extractUser(req);
    this.logger.log(`Activating workflow: ${id} by ${user.email}`);
    return this.workflowService.activateWorkflow(id, user);
  }

  /**
   * Delete workflow (only if not active)
   */
  @Delete(':id')
  @HttpCode(204)
  async deleteWorkflow(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<void> {
    const user = this.extractUser(req);
    this.logger.log(`Deleting workflow: ${id} by ${user.email}`);
    return this.workflowService.deleteWorkflow(id, user.tenantId);
  }

  // ========================================================================
  // WORKFLOW INSTANCES
  // ========================================================================

  /**
   * Initialize workflow for a document
   * Called when document is created
   */
  @Post(':docType/:docId')
  async initializeInstance(
    @Param('docType') docType: string,
    @Param('docId') docId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkflowInstance> {
    const user = this.extractUser(req);
    this.logger.debug(`Initializing workflow instance: ${docType}/${docId}`);
    return this.workflowService.initializeWorkflow(docType, docId, user.tenantId);
  }

  /**
   * Get current workflow status
   */
  @Get(':docType/:docId/status')
  async getStatus(
    @Param('docType') docType: string,
    @Param('docId') docId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkflowStatus> {
    const user = this.extractUser(req);
    return this.workflowService.getInstanceStatus(docType, docId, user.tenantId);
  }

  // ========================================================================
  // TRANSITIONS
  // ========================================================================

  /**
   * Execute a workflow transition (e.g., "Approve", "Reject")
   *
   * Process:
   * 1. Validate user has permission
   * 2. Evaluate all conditions
   * 3. If all conditions pass, execute actions (GL posting, notifications, etc.)
   * 4. Update state
   * 5. Record in approval history
   *
   * If any condition fails or action fails (failureAction: block_transition),
   * the entire transition is aborted (no state change).
   */
  @Post(':docType/:docId/transition')
  async executeTransition(
    @Param('docType') docType: string,
    @Param('docId') docId: string,
    @Body() dto: TransitionRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<TransitionResponseDto> {
    const user = this.extractUser(req);

    if (!dto.transitionLabel) {
      throw new BadRequestException('transitionLabel is required');
    }

    this.logger.log(
      `Transition requested: ${docType}/${docId} → "${dto.transitionLabel}" by ${user.email}`,
    );

    // Get the document from context (in real implementation, fetch from DB)
    // For now, we use a placeholder - actual implementation would load the real document
    const document = req.body || {};

    const instance = await this.workflowService.executeTransition(
      docType,
      docId,
      dto.transitionLabel,
      user,
      document,
      dto.comments,
    );

    return {
      previousStateId: instance.currentStateId, // Will be updated state, so this is simplified
      previousStateLabel: instance.currentStateLabel,
      newStateId: instance.currentStateId,
      newStateLabel: instance.currentStateLabel,
      transitionLabel: dto.transitionLabel,
      transitionExecutedAt: new Date(),
      conditionsEvaluated: [],
      actionsExecuted: [],
    };
  }

  // ========================================================================
  // APPROVAL HISTORY
  // ========================================================================

  /**
   * Get approval history for a document
   */
  @Get(':docType/:docId/history')
  async getHistory(
    @Param('docType') docType: string,
    @Param('docId') docId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApprovalRecord[]> {
    const user = this.extractUser(req);
    return this.workflowService.getApprovalHistory(docType, docId, user.tenantId);
  }

  // ========================================================================
  // APPROVAL INBOX
  // ========================================================================

  /**
   * Get user's pending approvals
   */
  @Get('inbox/my-approvals')
  async getMyApprovals(@Req() req: AuthenticatedRequest): Promise<ApprovalRecord[]> {
    const user = this.extractUser(req);
    return this.workflowService.getApprovalInbox(user.tenantId, user.id);
  }

  /**
   * Quick approve from inbox
   */
  @Post('inbox/:approvalId/approve')
  async approveFromInbox(
    @Param('approvalId') approvalId: string,
    @Body() body: { comments?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.extractUser(req);
    this.logger.log(`Approved from inbox: ${approvalId} by ${user.email}`);
    // Implementation would fetch pending approval and execute transition
    return { success: true, approvalId };
  }

  /**
   * Quick reject from inbox
   */
  @Post('inbox/:approvalId/reject')
  async rejectFromInbox(
    @Param('approvalId') approvalId: string,
    @Body() body: { comments?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.extractUser(req);
    this.logger.log(`Rejected from inbox: ${approvalId} by ${user.email}`);
    // Implementation would fetch pending approval and execute transition
    return { success: true, approvalId };
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private extractUser(req: AuthenticatedRequest) {
    return {
      id: req.user.id,
      email: req.user.email,
      roles: req.user.roles || [],
      tenantId: req.user.tenantId,
    };
  }
}
