import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  MaterialRequestedPayload,
  RequisitionService,
} from './requisition.service';

@Injectable()
export class RequisitionListener {
  private readonly logger = new Logger(RequisitionListener.name);

  constructor(private readonly requisitionService: RequisitionService) {}

  @OnEvent('project.material_requested')
  async onMaterialRequested(payload: MaterialRequestedPayload) {
    this.logger.log(
      `Handling project.material_requested for project ${payload.projectId}`,
    );
    try {
      await this.requisitionService.createFromMaterialRequest(payload);
    } catch (err) {
      this.logger.error(
        `Failed to create requisition for project ${payload.projectId}`,
        err,
      );
    }
  }
}
