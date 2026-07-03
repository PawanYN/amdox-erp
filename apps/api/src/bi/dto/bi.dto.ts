import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BiDataSource } from '../bi-data.service';

const WIDGET_TYPES = [
  'bar',
  'line',
  'pie',
  'heatmap',
  'funnel',
  'gauge',
  'card',
  'waterfall',
  'scatter',
  'treemap',
] as const;

const DATA_SOURCES: BiDataSource[] = [
  'ar_aging',
  'inventory',
  'purchase_orders',
  'employees_by_department',
  'project_funnel',
  'resource_heatmap',
];

export class WidgetConfigDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(DATA_SOURCES)
  dataSource?: BiDataSource;

  /** Query Guard read-model attributes (dimension, metric, aggregation, etc.) */
  @IsOptional()
  @IsObject()
  queryAttrs?: Record<string, string>;

  /** Field filters applied before aggregation */
  @IsOptional()
  @IsArray()
  filters?: { field: string; op: string; value: string }[];

  /** Visual formatting (colors, labels, layout) */
  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;
}

export class AddWidgetDto {
  @IsUUID()
  dashboardId: string;

  @IsIn(WIDGET_TYPES as unknown as string[])
  type: string;

  @IsObject()
  @ValidateNested()
  @Type(() => WidgetConfigDto)
  config: WidgetConfigDto;
}

export class UpdateWidgetDto {
  @IsOptional()
  @IsIn(WIDGET_TYPES as unknown as string[])
  type?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WidgetConfigDto)
  config?: WidgetConfigDto;
}

export class CreateScheduledReportDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['hourly', 'daily', 'weekly', 'monthly', 'DAILY', 'WEEKLY', 'MONTHLY'])
  cronExpr: string;

  @IsString()
  @IsIn(['PDF', 'EXCEL'])
  format: string;

  @IsArray()
  @IsString({ each: true })
  recipients: string[];

  @IsOptional()
  @IsUUID()
  dashboardId?: string;
}

export class DrillDownDto {
  @IsString()
  @IsIn(DATA_SOURCES)
  dataSource: BiDataSource;

  @IsString()
  filterKey: string;

  @IsOptional()
  @IsString()
  filterValue?: string;
}

export class BiFilterQueryDto {
  @IsOptional()
  @IsIn(['all', 'current', 'overdue'])
  period?: string;

  @IsOptional()
  @IsIn(['all', 'open', 'closed'])
  status?: string;

  @IsOptional()
  @IsString()
  department?: string;
}
