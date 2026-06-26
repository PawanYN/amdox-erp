import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlService } from './gl.service';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { CreateAccountDto } from '../dto/create-account.dto';

/**
 * Controller for General Ledger (GL) operations.
 * Handles manual journal entries and chart of accounts.
 */
@ApiTags('General Ledger')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('finance/gl')
export class GlController {
  constructor(private readonly glService: GlService) {}

  /**
   * Creates a new Account in the Chart of Accounts (CoA).
   */
  @Roles('Manager', 'TenantAdmin')
  @Post('accounts')
  @ApiOperation({ summary: 'Create a new Account in the Chart of Accounts' })
  async createAccount(
    @Req() req: any,
    @Body() createAccountDto: CreateAccountDto
  ) {
    return this.glService.createAccount(req.user.tenantId, createAccountDto);
  }

  /**
   * Retrieves all active accounts in the Chart of Accounts.
   */
  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get('accounts')
  @ApiOperation({ summary: 'Retrieve all active accounts' })
  async getAccounts(@Req() req: any) {
    return this.glService.getAccounts(req.user.tenantId);
  }

  /**
   * Opens a new Fiscal Period.
   */
  @Roles('TenantAdmin')
  @Post('fiscal-periods/open')
  @ApiOperation({ summary: 'Open a new Fiscal Period' })
  async openFiscalPeriod(
    @Req() req: any,
    @Body('name') name: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string
  ) {
    return this.glService.openFiscalPeriod(req.user.tenantId, name, new Date(startDate), new Date(endDate));
  }

  /**
   * Closes (locks) a Fiscal Period.
   */
  @Roles('TenantAdmin')
  @Post('fiscal-periods/:id/close')
  @ApiOperation({ summary: 'Close (lock) a Fiscal Period' })
  async closeFiscalPeriod(
    @Req() req: any,
    @Param('id') periodId: string
  ) {
    return this.glService.closeFiscalPeriod(req.user.tenantId, periodId);
  }

  /**
   * Posts a manual Journal Entry, strictly validating double-entry accounting rules (Debit = Credit).
   */
  @Roles('Manager', 'TenantAdmin')
  @Post('journal-entries')
  @ApiOperation({ summary: 'Create a manual Journal Entry' })
  async createJournalEntry(
    @Req() req: any, 
    @Body() createJournalEntryDto: CreateJournalEntryDto
  ) {
    return this.glService.createJournalEntry(req.user.tenantId, createJournalEntryDto);
  }
}
