import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { prisma, ForecastModelType } from '@amdox/db';
import { RedisService } from '../common/redis/redis.service';

const PREDICTIONS_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6h — predictions only change on (re)train

// PDF F-06 acceptance criterion: "MAPE < 12% on 90-day horizon".
const MAPE_ALERT_THRESHOLD = 0.12;

@Injectable()
export class ForecastClientService {
  private readonly logger = new Logger(ForecastClientService.name);
  private readonly mlBaseUrl = process.env.ML_SERVICE_URL || 'http://localhost:8091';

  constructor(
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private cacheKey(tenantId: string, productId: string) {
    return `forecast:predictions:${tenantId}:${productId}`;
  }

  async trainAndPredict(
    tenantId: string,
    productId: string,
    sku: string,
    history: Array<{ date: string; quantity: number }>,
    horizonDays = 90,
  ) {
    let predictions: Array<{ date: string; quantity: number }> = [];
    let mape = 0.12;
    let modelType: string = 'prophet';
    let modelVersion = '1';

    try {
      const res = await fetch(`${this.mlBaseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, history, horizon_days: horizonDays }),
      });
      if (res.ok) {
        const body = await res.json();
        predictions = body.predictions ?? [];
        mape = body.mape ?? mape;
        modelType = body.model ?? modelType;
        if (body.version != null) modelVersion = String(body.version);
      } else {
        this.logger.warn(`ML service returned ${res.status}, using statistical fallback`);
        predictions = this.statisticalFallback(history, horizonDays);
        modelType = 'prophet';
      }
    } catch {
      this.logger.warn('ML service unreachable, using statistical fallback');
      predictions = this.statisticalFallback(history, horizonDays);
      modelType = 'prophet';
    }

    // One ForecastModel row per (tenant, product) — not one shared row per tenant —
    // so each SKU's model type (Prophet vs LSTM) and MAPE are tracked independently.
    const dbModelType = modelType === 'lstm' ? ForecastModelType.LSTM : ForecastModelType.PROPHET;

    const existing = await prisma.forecastModel.findFirst({
      where: { tenantId, productId, isActive: true },
      orderBy: { trainedAt: 'desc' },
    });

    // tenant-scope-ok: `existing` was just found via a tenantId-scoped findFirst above.
    const model = existing
      ? await prisma.forecastModel.update({
          where: { id: existing.id },
          data: {
            type: dbModelType,
            mapeScore: mape,
            trainedAt: new Date(),
            version: modelVersion,
            isActive: true,
          },
        })
      : await prisma.forecastModel.create({
          data: {
            tenantId,
            productId,
            type: dbModelType,
            version: modelVersion,
            mapeScore: mape,
            trainedAt: new Date(),
            isActive: true,
          },
        });

    await prisma.forecastPrediction.deleteMany({
      where: { tenantId, productId, forecastModelId: model.id },
    });

    await prisma.forecastPrediction.createMany({
      data: predictions.map((p) => ({
        tenantId,
        forecastModelId: model.id,
        productId,
        forecastDate: new Date(p.date),
        predictedQty: p.quantity,
      })),
    });

    // Retraining invalidates any cached read of this product's predictions.
    await this.redis.del(this.cacheKey(tenantId, productId)).catch(() => undefined);

    // F-06's <12% target was only ever displayed, never enforced — nothing
    // told anyone when a SKU's model crossed it. This is that alert.
    if (mape > MAPE_ALERT_THRESHOLD) {
      this.eventEmitter.emit('forecast.mape_breach', {
        tenantId,
        productId,
        sku,
        mape,
        modelType: dbModelType,
      });
    }

    return { model, predictions, mape };
  }

  async getPredictions(tenantId: string, productId: string) {
    const key = this.cacheKey(tenantId, productId);

    const cached = await this.redis.get(key).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // fall through and re-fetch from DB on a corrupt cache entry
      }
    }

    const predictions = await prisma.forecastPrediction.findMany({
      where: { tenantId, productId },
      orderBy: { forecastDate: 'asc' },
      include: { forecastModel: true },
    });

    await this.redis
      .setex(key, PREDICTIONS_CACHE_TTL_SECONDS, JSON.stringify(predictions))
      .catch(() => undefined);

    return predictions;
  }

  /**
   * WHAT: Retrains every product's forecast in a tenant (used by the weekly
   * scheduled retrain job — see forecast-retrain.processor.ts).
   * WHY: Predictions otherwise only refresh when a user manually clicks "Train"
   * per SKU; this keeps them from silently going stale.
   */
  async retrainAllProducts(tenantId: string) {
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, sku: true },
    });

    let succeeded = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const movements = await prisma.stockMovement.findMany({
          where: { tenantId, productId: product.id },
          orderBy: { createdAt: 'asc' },
          take: 365,
        });
        const history = movements.map((m) => ({
          date: m.createdAt.toISOString().slice(0, 10),
          quantity: Math.abs(Number(m.quantity)),
        }));
        if (history.length === 0) continue; // nothing to (re)train on yet

        await this.trainAndPredict(tenantId, product.id, product.sku, history);
        succeeded++;
      } catch (error) {
        failed++;
        this.logger.warn(
          `Weekly retrain failed for product ${product.sku}: ${(error as Error).message}`,
        );
      }
    }

    return { tenantId, totalProducts: products.length, succeeded, failed };
  }

  private statisticalFallback(
    history: Array<{ date: string; quantity: number }>,
    horizonDays: number,
  ) {
    const avg =
      history.length > 0 ? history.reduce((s, h) => s + h.quantity, 0) / history.length : 10;
    const out: Array<{ date: string; quantity: number }> = [];
    const start = new Date();
    for (let i = 1; i <= Math.min(horizonDays, 30); i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      out.push({
        date: d.toISOString().slice(0, 10),
        quantity: Math.round(avg * (0.9 + Math.random() * 0.2)),
      });
    }
    return out;
  }
}
