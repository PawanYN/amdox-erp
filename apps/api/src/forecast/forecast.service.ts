import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, ForecastModelType } from '@amdox/db';

@Injectable()
export class ForecastClientService {
  private readonly logger = new Logger(ForecastClientService.name);
  private prisma = new PrismaClient();
  private readonly mlBaseUrl =
    process.env.ML_SERVICE_URL || 'http://localhost:8091';

  async trainAndPredict(
    tenantId: string,
    productId: string,
    sku: string,
    history: Array<{ date: string; quantity: number }>,
    horizonDays = 90,
  ) {
    let predictions: Array<{ date: string; quantity: number }> = [];
    let mape = 0.12;

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
      } else {
        this.logger.warn(`ML service returned ${res.status}, using statistical fallback`);
        predictions = this.statisticalFallback(history, horizonDays);
      }
    } catch {
      this.logger.warn('ML service unreachable, using statistical fallback');
      predictions = this.statisticalFallback(history, horizonDays);
    }

    const existing = await this.prisma.forecastModel.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { trainedAt: 'desc' },
    });

    const model = existing
      ? await this.prisma.forecastModel.update({
          where: { id: existing.id },
          data: { mapeScore: mape, trainedAt: new Date(), version: '1.0', isActive: true },
        })
      : await this.prisma.forecastModel.create({
          data: {
            tenantId,
            type: ForecastModelType.PROPHET,
            version: '1.0',
            mapeScore: mape,
            trainedAt: new Date(),
            isActive: true,
          },
        });

    await this.prisma.forecastPrediction.deleteMany({
      where: { tenantId, productId, forecastModelId: model.id },
    });

    await this.prisma.forecastPrediction.createMany({
      data: predictions.map((p) => ({
        tenantId,
        forecastModelId: model.id,
        productId,
        forecastDate: new Date(p.date),
        predictedQty: p.quantity,
      })),
    });

    return { model, predictions, mape };
  }

  async getPredictions(tenantId: string, productId: string) {
    return this.prisma.forecastPrediction.findMany({
      where: { tenantId, productId },
      orderBy: { forecastDate: 'asc' },
      include: { forecastModel: true },
    });
  }

  private statisticalFallback(
    history: Array<{ date: string; quantity: number }>,
    horizonDays: number,
  ) {
    const avg =
      history.length > 0
        ? history.reduce((s, h) => s + h.quantity, 0) / history.length
        : 10;
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
