"use client";

import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BiDataSource, WidgetType } from "@/lib/api/bi-api";
import type { BiWidgetStyleConfig } from "@/lib/types/bi";
import { PBI_CHART_COLORS } from "./power-bi-theme";
import { resolvePaletteColors } from "./widget-config-schema";
import {
  GaugeChart,
  CardKpi,
  WaterfallChart,
  ScatterChart,
  TreemapChart,
} from "./advanced-charts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type ChartProps = {
  type: WidgetType;
  series?: { name: string; value: number; key?: string }[];
  heatmap?: { x: string; y: string; value: number }[];
  onSegmentClick?: (key: string, name: string) => void;
  activeKey?: string | null;
  config?: {
    title?: string;
    style?: BiWidgetStyleConfig;
    max?: number;
    format?: "number" | "percent" | "currency";
    change?: number;
    trend?: "up" | "down" | "neutral";
    scatterData?: { name: string; x: number; y: number; size?: number }[];
    xLabel?: string;
    yLabel?: string;
  };
};

function getStyle(config?: ChartProps["config"]): BiWidgetStyleConfig {
  return config?.style || {};
}

function getColors(style: BiWidgetStyleConfig): string[] {
  return resolvePaletteColors(style.colorPalette);
}

const HEAT_GRADIENTS: Record<string, [string, string, string]> = {
  blues: ["#DEECF9", "#0078D4", "#004578"],
  gold: ["#FFF4CE", "#FFB900", "#CA5010"],
  greens: ["#DFF6DD", "#107C10", "#004B1C"],
  redGreen: ["#E81123", "#FFB900", "#107C10"],
};

export function BiWidgetChart({ type, series = [], heatmap = [], onSegmentClick, activeKey, config }: ChartProps) {
  const style = getStyle(config);
  const colors = getColors(style);
  const data = series.map((s) => ({ ...s, label: s.name }));

  const handleClick = (entry: { payload?: { key?: string; name?: string }; name?: string }) => {
    const key = entry?.payload?.key || entry?.name;
    onSegmentClick?.(key || "", entry?.name || key || "");
  };

  const gridProps = style.showGrid !== false ? { strokeDasharray: "3 3", stroke: "#EDEBE9" } : undefined;

  if (type === "gauge" && series.length > 0) {
    return (
      <GaugeChart
        value={series[0].value}
        max={style.max ?? config?.max ?? 100}
        title={config?.title || series[0].name}
        format={style.format || config?.format || "number"}
      />
    );
  }

  if (type === "card" && series.length > 0) {
    return (
      <CardKpi
        title={config?.title || series[0].name}
        value={series[0].value}
        change={config?.change}
        trend={style.trend || config?.trend}
        format={style.format || config?.format || "number"}
      />
    );
  }

  if (type === "waterfall" && series.length > 0) {
    return (
      <WaterfallChart
        data={series.map((s) => ({ name: s.name, value: s.value, isTotal: s.key?.includes("Total") }))}
        positiveColor={style.positiveColor}
        negativeColor={style.negativeColor}
      />
    );
  }

  if (type === "scatter" && config?.scatterData) {
    return (
      <ScatterChart
        data={config.scatterData}
        xLabel={config.xLabel}
        yLabel={config.yLabel}
        pointSize={style.pointSize}
        color={colors[0]}
      />
    );
  }

  if (type === "treemap" && series.length > 0) {
    return (
      <TreemapChart
        data={series.map((s) => ({ name: s.name, value: s.value }))}
        colors={colors}
        showLabels={style.showLabels !== false}
      />
    );
  }

  if (type === "heatmap" && heatmap.length > 0) {
    const xs = [...new Set(heatmap.map((c) => c.x))];
    const ys = [...new Set(heatmap.map((c) => c.y))];
    const max = Math.max(...heatmap.map((c) => c.value), 1);
    const gradient = HEAT_GRADIENTS[style.colorScheme || "blues"] || HEAT_GRADIENTS.blues;

    const option = {
      tooltip: { position: "top" },
      grid: { left: 80, right: 20, top: 20, bottom: 60 },
      xAxis: {
        type: "category",
        data: xs,
        splitArea: { show: style.showGrid !== false },
        axisLine: { show: style.showGrid !== false },
      },
      yAxis: {
        type: "category",
        data: ys,
        splitArea: { show: style.showGrid !== false },
        axisLine: { show: style.showGrid !== false },
      },
      visualMap: {
        min: 0,
        max,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: { color: gradient },
      },
      series: [
        {
          name: "Value",
          type: "heatmap",
          data: heatmap.map((c) => [c.x, c.y, c.value]),
          label: { show: !!style.showValues, fontSize: 10 },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" } },
        },
      ],
    };

    return (
      <ReactECharts
        option={option}
        style={{ height: 260, width: "100%" }}
        onEvents={{
          click: (params: { data?: [string, string, number]; name?: string }) => {
            const projectName = params?.data?.[0] || params?.name;
            if (projectName) onSegmentClick?.(projectName, projectName);
          },
        }}
      />
    );
  }

  if (type === "funnel") {
    let funnelData = data.map((d) => ({ name: d.name, value: d.value }));
    if (style.sort === "asc") {
      funnelData = [...funnelData].sort((a, b) => a.value - b.value);
    } else if (style.sort !== "none") {
      funnelData = [...funnelData].sort((a, b) => b.value - a.value);
    }

    const option = {
      tooltip: { trigger: "item", formatter: "{b}: {c}" },
      color: colors,
      series: [
        {
          type: "funnel",
          left: "10%",
          width: "80%",
          gap: style.gap ?? 2,
          label: { show: style.showLabels !== false, position: "inside" },
          data: funnelData,
        },
      ],
    };
    return (
      <ReactECharts
        option={option}
        style={{ height: 260, width: "100%" }}
        onEvents={{
          click: (params: { name?: string }) => onSegmentClick?.(params.name || "", params.name || ""),
        }}
      />
    );
  }

  if (type === "pie") {
    const innerRadius = style.donut ? `${style.innerRadiusPct || 45}%` : 0;
    const outerRadius = 90;

    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            label={style.showLabels !== false}
            onClick={handleClick}
            style={{ cursor: onSegmentClick ? "pointer" : "default" }}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
                opacity={activeKey && (d.key || d.name) !== activeKey ? 0.35 : 1}
                stroke={activeKey === (d.key || d.name) ? "#252423" : undefined}
                strokeWidth={activeKey === (d.key || d.name) ? 2 : 0}
              />
            ))}
          </Pie>
          {style.showLegend !== false && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    const lineColor = style.lineColor || colors[0] || "#118DFF";
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          {gridProps && <CartesianGrid {...gridProps} />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          {style.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Line
            type={style.smooth ? "monotone" : "linear"}
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            dot={style.showPoints !== false ? { r: 4, fill: lineColor } : false}
            fill={style.showArea ? lineColor : undefined}
            fillOpacity={style.showArea ? 0.15 : 0}
            onClick={handleClick}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const isHorizontal = style.orientation === "horizontal";
  const barColor = colors[0] || PBI_CHART_COLORS[0];
  const radius = style.barRadius ?? 2;

  if (isHorizontal) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical">
          {gridProps && <CartesianGrid {...gridProps} />}
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip />
          {style.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar
            dataKey="value"
            fill={barColor}
            radius={[0, radius, radius, 0]}
            label={style.showDataLabels ? { position: "right", fontSize: 10 } : undefined}
            onClick={handleClick}
            style={{ cursor: onSegmentClick ? "pointer" : "default" }}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        {gridProps && <CartesianGrid {...gridProps} />}
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        {style.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Bar
          dataKey="value"
          fill={barColor}
          radius={[radius, radius, 0, 0]}
          label={style.showDataLabels ? { position: "top", fontSize: 10 } : undefined}
          onClick={handleClick}
          style={{ cursor: onSegmentClick ? "pointer" : "default" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const DATA_SOURCE_OPTIONS: { value: BiDataSource; label: string; defaultType: WidgetType }[] = [
  { value: "ar_aging", label: "AR Aging", defaultType: "pie" },
  { value: "inventory", label: "Inventory levels", defaultType: "bar" },
  { value: "purchase_orders", label: "Purchase orders by status", defaultType: "bar" },
  { value: "employees_by_department", label: "Employees by department", defaultType: "pie" },
  { value: "project_funnel", label: "Project funnel", defaultType: "funnel" },
  { value: "resource_heatmap", label: "Resource utilisation heatmap", defaultType: "heatmap" },
];

export const WIDGET_TYPES: WidgetType[] = ["bar", "line", "pie", "heatmap", "funnel", "gauge", "card", "waterfall", "scatter", "treemap"];
