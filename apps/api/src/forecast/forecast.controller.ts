import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrismaClient } from '@amdox/db';
import { ForecastClientService } from './forecast.service';

@ApiTags('AI Demand Forecasting')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('forecast')
export class ForecastController {
  private prisma = new PrismaClient();

  constructor(private readonly forecastService: ForecastClientService) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
  }

  @Post('products/:productId/train')
  @ApiOperation({ summary: 'Train Prophet model and store SKU-level predictions' })
  async train(@Req() req: any, @Param('productId') productId: string) {
    const tenantId = this.tenantId(req);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) return { error: 'Product not found' };

    const movements = await this.prisma.stockMovement.findMany({
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

    return this.forecastService.trainAndPredict(
      tenantId,
      productId,
      product.sku,
      history,
    );
  }

  @Get('products/:productId')
  @ApiOperation({ summary: 'Get stored demand predictions for SKU' })
  getPredictions(@Req() req: any, @Param('productId') productId: string) {
    return this.forecastService.getPredictions(this.tenantId(req), productId);
  }
}
