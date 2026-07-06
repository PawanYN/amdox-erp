import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { Cron, CronExpression } from '@nestjs/schedule';

// ECB's free daily reference-rate feed. EUR is always the implicit base
// (omitted from the feed itself, since 1 EUR = 1 EUR). No API key required.
const ECB_DAILY_FEED_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

interface EcbDailyRates {
  asOfDate: Date;
  rates: Record<string, number>; // ISO 4217 code -> units per 1 EUR
}

/**
 * Service to handle multi-currency conversions and FX rate fetching.
 *
 * WHAT: Manages the fetching and storing of foreign exchange (FX) rates.
 * WHY: Multi-currency support (F-02 requirement) necessitates daily FX fetches
 * from the ECB reference-rate feed to accurately value cross-currency
 * transactions and generate consolidated financial reports.
 */
@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);
  private prisma = new PrismaClient();

  /**
   * WHAT: Fetches the ECB daily reference rates and stores one EUR -> X
   * ExchangeRate row per currency, per tenant.
   * WHY: Keeps the local database up-to-date with current rates, allowing
   * currency conversion across the ERP without hitting an external API for
   * every transaction. Scheduled to run every day at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchDailyRates() {
    let ecb: EcbDailyRates;
    try {
      ecb = await this.fetchEcbRates();
    } catch (error) {
      this.logger.error('Failed to fetch ECB daily FX rates', (error as Error).message);
      return;
    }

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      await this.storeRatesForTenant(tenant.id, ecb);
    }

    this.logger.log(
      `Stored ECB FX rates (${Object.keys(ecb.rates).length} currencies, as of ${ecb.asOfDate.toISOString().slice(0, 10)}) for ${tenants.length} tenant(s).`,
    );
  }

  private async fetchEcbRates(): Promise<EcbDailyRates> {
    const response = await fetch(ECB_DAILY_FEED_URL);
    if (!response.ok) {
      throw new Error(`ECB feed request failed with HTTP ${response.status}`);
    }
    const xml = await response.text();

    const dateMatch = xml.match(/<Cube time=['"](\d{4}-\d{2}-\d{2})['"]/);
    if (!dateMatch) {
      throw new Error('ECB feed response did not contain a rate date');
    }

    const rates: Record<string, number> = {};
    const rateRegex = /<Cube currency=['"]([A-Z]{3})['"] rate=['"]([\d.]+)['"]\s*\/>/g;
    let match: RegExpExecArray | null;
    while ((match = rateRegex.exec(xml)) !== null) {
      rates[match[1]] = parseFloat(match[2]);
    }

    if (Object.keys(rates).length === 0) {
      throw new Error('ECB feed response did not contain any currency rates');
    }

    return { asOfDate: new Date(`${dateMatch[1]}T00:00:00.000Z`), rates };
  }

  private async storeRatesForTenant(tenantId: string, ecb: EcbDailyRates) {
    const eur = await this.getOrCreateCurrency(tenantId, 'EUR', true);

    for (const [code, rate] of Object.entries(ecb.rates)) {
      const quote = await this.getOrCreateCurrency(tenantId, code, false);

      await this.prisma.exchangeRate.upsert({
        where: {
          tenantId_fromCurrencyId_toCurrencyId_asOfDate: {
            tenantId,
            fromCurrencyId: eur.id,
            toCurrencyId: quote.id,
            asOfDate: ecb.asOfDate,
          },
        },
        create: {
          tenantId,
          fromCurrencyId: eur.id,
          toCurrencyId: quote.id,
          rate,
          asOfDate: ecb.asOfDate,
          source: 'ECB',
        },
        update: {
          rate,
          source: 'ECB',
        },
      });
    }
  }

  private async getOrCreateCurrency(tenantId: string, code: string, isBase: boolean) {
    const existing = await this.prisma.currency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (existing) return existing;
    return this.prisma.currency.create({ data: { tenantId, code, isBase } });
  }
}
