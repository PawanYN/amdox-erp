import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaveAccrualService } from './leave-accrual.service';

@Injectable()
export class LeaveAccrualScheduler {
  constructor(private readonly accrualService: LeaveAccrualService) {}

  /** Grants each tenant's employees their monthly leave accrual. */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async runMonthlyAccrual() {
    await this.accrualService.runAccrual();
  }
}
