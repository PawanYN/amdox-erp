import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { prisma } from '@amdox/db';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireModule } from '../auth/decorators/require-module.decorator';
import { ForecastClientService } from './forecast.service';

@ApiTags('AI Demand Forecasting')
@ApiBearerAuth()
@RequireModule('forecast')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastClientService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('products/:productId/train')
  @ApiOperation({ summary: 'Train Prophet model and store SKU-level predictions' })
  async train(@Req() req: any, @Param('productId') productId: string) {
    const tenantId = this.tenantId(req);
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) return { error: 'Product not found' };

    const movements = await prisma.stockMovement.findMany({
      where: { tenantId, productId },
      orderBy: { createdAt: 'asc' },
      take: 365,
    });

    const history = movements.map((m) => ({
      date: m.createdAt.toISOString().slice(0, 10),
      quantity: Math.abs(Number(m.quantity)),
    }));

    if (history.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      history.push({ date: today, quantity: 10 });
    }

    return this.forecastService.trainAndPredict(tenantId, productId, product.sku, history);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('products/:productId')
  @ApiOperation({ summary: 'Get stored demand predictions for SKU' })
  getPredictions(@Req() req: any, @Param('productId') productId: string) {
    return this.forecastService.getPredictions(this.tenantId(req), productId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('products')
  @ApiOperation({ summary: 'List all products with their latest forecast model info' })
  async getAllForecastStatus(@Req() req: any) {
    const tenantId = this.tenantId(req);
    const products = await prisma.product.findMany({
      where: { tenantId },
      select: { id: true, sku: true, name: true },
      orderBy: { name: 'asc' },
    });

    const results = await Promise.all(
      products.map(async (product) => {
        const predictions = await prisma.forecastPrediction.findMany({
          where: { tenantId, productId: product.id },
          include: { forecastModel: true },
          orderBy: { forecastDate: 'asc' },
        });
        const model = predictions[0]?.forecastModel ?? null;
        return {
          ...product,
          predictionCount: predictions.length,
          mapeScore: model?.mapeScore ?? null,
          trainedAt: model?.trainedAt ?? null,
          modelType: model?.type ?? null,
        };
      }),
    );

    return results;
  }
}
