import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { GlService } from './gl.service';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { CreateAccountDto } from '../dto/create-account.dto';
import { CreateIntercompanyTransferDto } from '../dto/create-intercompany-transfer.dto';

/**
 * Controller for General Ledger (GL) operations.
 * Handles manual journal entries and chart of accounts.
 */
@ApiTags('General Ledger')
@ApiBearerAuth()
@RequireModule('finance')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('finance/gl')
export class GlController {
  constructor(private readonly glService: GlService) {}

  /**
   * Creates a new Account in the Chart of Accounts (CoA).
   */
  @Roles('Manager', 'TenantAdmin')
  @Post('accounts')
  @ApiOperation({ summary: 'Create a new Account in the Chart of Accounts' })
  async createAccount(@Req() req: any, @Body() createAccountDto: CreateAccountDto) {
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
   * Returns posted journal-line balances per account (debit − credit).
   * Must stay before any `accounts/:id` route so "balances" is not captured as an id.
   */
  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get('accounts/balances')
  @ApiOperation({ summary: 'Retrieve GL account balances from posted journal lines' })
  async getAccountBalances(@Req() req: any) {
    return this.glService.getAccountBalances(req.user.tenantId);
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
    @Body('endDate') endDate: string,
  ) {
    return this.glService.openFiscalPeriod(
      req.user.tenantId,
      name,
      new Date(startDate),
      new Date(endDate),
    );
  }

  /**
   * Closes (locks) a Fiscal Period.
   */
  @Roles('TenantAdmin')
  @Post('fiscal-periods/:id/close')
  @ApiOperation({ summary: 'Close (lock) a Fiscal Period' })
  async closeFiscalPeriod(@Req() req: any, @Param('id') periodId: string) {
    return this.glService.closeFiscalPeriod(
      req.user.tenantId,
      periodId,
      req.user.id ?? req.user.sub,
    );
  }

  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get('fiscal-periods')
  @ApiOperation({ summary: 'List fiscal periods for tenant' })
  async listFiscalPeriods(@Req() req: any) {
    return this.glService.listFiscalPeriods(req.user.tenantId);
  }

  /**
   * Returns (or creates) the open fiscal period for the current calendar month.
   */
  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get('fiscal-periods/current')
  @ApiOperation({ summary: 'Get or create the current fiscal period' })
  async getCurrentFiscalPeriod(@Req() req: any) {
    return this.glService.getOrCreateCurrentFiscalPeriod(req.user.tenantId);
  }

  /**
   * Posts a manual Journal Entry, strictly validating double-entry accounting rules (Debit = Credit).
   */
  @Roles('Manager', 'TenantAdmin')
  @Post('journal-entries')
  @ApiOperation({ summary: 'Create a manual Journal Entry' })
  async createJournalEntry(@Req() req: any, @Body() createJournalEntryDto: CreateJournalEntryDto) {
    return this.glService.createJournalEntry(
      req.user.tenantId,
      createJournalEntryDto,
      req.user.id ?? req.user.sub,
    );
  }

  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries for tenant' })
  async getJournalEntries(@Req() req: any) {
    return this.glService.getJournalEntries(req.user.tenantId);
  }

  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get('intercompany-transfers')
  @ApiOperation({ summary: 'List intercompany transfers' })
  async listIntercompanyTransfers(@Req() req: any) {
    return this.glService.listIntercompanyTransfers(req.user.tenantId);
  }

  @Roles('TenantAdmin')
  @Post('intercompany-transfers')
  @ApiOperation({ summary: 'Create intercompany transfer with GL journal entry' })
  async createIntercompanyTransfer(@Req() req: any, @Body() dto: CreateIntercompanyTransferDto) {
    return this.glService.createIntercompanyTransfer(
      req.user.tenantId,
      dto,
      req.user.id ?? req.user.sub,
    );
  }
}
