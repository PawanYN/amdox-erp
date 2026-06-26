import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Service to handle multi-currency conversions and FX rate fetching.
 * 
 * WHAT: Manages the fetching and storing of foreign exchange (FX) rates.
 * WHY: Multi-currency support (F-02 requirement) necessitates daily FX fetches (e.g., ECB/OpenExchangeRates)
 * to accurately value cross-currency transactions and generate consolidated financial reports.
 */
@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);
  private prisma = new PrismaClient();

  /**
   * WHAT: Mocks the process of fetching daily exchange rates from an external API.
   * WHY: Keeps the local database up-to-date with current rates, allowing real-time currency
   * conversion across the ERP without hitting an external API for every transaction.
   * It is scheduled to run every day at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchDailyRates() {
    // In a real app, we'd loop through all active tenants and fetch rates for their currencies.
    // For demonstration, we'll assume a single tenant or hardcode a tenantId.
    const tenantId = '00000000-0000-0000-0000-000000000000'; // Default tenant

    this.logger.log(`Fetching daily FX rates via Cron for tenant ${tenantId}...`);
    
    // Ensure base currency exists (e.g. USD)
    let usd = await this.prisma.currency.findFirst({ where: { tenantId, code: 'USD' } });
    if (!usd) {
      usd = await this.prisma.currency.create({
        data: { tenantId, code: 'USD', symbol: '$', isBase: true }
      });
    }

    let eur = await this.prisma.currency.findFirst({ where: { tenantId, code: 'EUR' } });
    if (!eur) {
      eur = await this.prisma.currency.create({
        data: { tenantId, code: 'EUR', symbol: '€', isBase: false }
      });
    }

    // Mock an API response
    const mockApiRates = {
      'EUR': 0.92 // 1 USD = 0.92 EUR
    };

    // Store in DB
    await this.prisma.exchangeRate.create({
      data: {
        tenantId,
        fromCurrencyId: usd.id,
        toCurrencyId: eur.id,
        rate: mockApiRates['EUR'],
        asOfDate: new Date(),
        source: 'OpenExchangeRates (Mock)'
      }
    });

    this.logger.log('Successfully fetched and saved daily FX rates via Cron.');
  }
}
