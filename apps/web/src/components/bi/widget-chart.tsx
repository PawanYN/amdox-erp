"use client";

import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  Cell,
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
import { PBI_CHART_COLORS } from "./power-bi-theme";
import {
  GaugeChart,
  CardKpi,
  WaterfallChart,
  ScatterChart,
  TreemapChart,
} from "./advanced-charts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const COLORS = PBI_CHART_COLORS;

type ChartProps = {
  type: WidgetType;
  series?: { name: string; value: number; key?: string }[];
  heatmap?: { x: string; y: string; value: number }[];
  onSegmentClick?: (key: string, name: string) => void;
  activeKey?: string | null;
  config?: any;
};

export function BiWidgetChart({ type, series = [], heatmap = [], onSegmentClick, activeKey, config }: ChartProps) {
  const data = series.map((s) => ({ ...s, label: s.name }));

  const handleClick = (entry: any) => {
    const key = entry?.payload?.key || entry?.name;
    onSegmentClick?.(key, entry?.name || key);
  };

  if (type === "gauge" && series.length > 0) {
    return (
      <GaugeChart
        value={series[0].value}
        max={config?.max || 100}
        title={config?.title || series[0].name}
        format={config?.format || "number"}
      />
    );
  }

  if (type === "card" && series.length > 0) {
    return (
      <CardKpi
        title={config?.title || series[0].name}
        value={series[0].value}
        change={config?.change}
        trend={config?.trend}
        format={config?.format || "number"}
      />
    );
  }

  if (type === "waterfall" && series.length > 0) {
    return <WaterfallChart data={series.map((s) => ({ name: s.name, value: s.value, isTotal: s.key?.includes("Total") }))} />;
  }

  if (type === "scatter" && config?.scatterData) {
    return (
      <ScatterChart
        data={config.scatterData}
        xLabel={config.xLabel}
        yLabel={config.yLabel}
      />
    );
  }

  if (type === "treemap" && series.length > 0) {
    return <TreemapChart data={series.map((s) => ({ name: s.name, value: s.value }))} />;
  }

  if (type === "heatmap" && heatmap.length > 0) {
    const xs = [...new Set(heatmap.map((c) => c.x))];
    const ys = [...new Set(heatmap.map((c) => c.y))];
    const max = Math.max(...heatmap.map((c) => c.value), 1);

    const option = {
      tooltip: { position: "top" },
      grid: { left: 80, right: 20, top: 20, bottom: 60 },
      xAxis: { type: "category", data: xs, splitArea: { show: true } },
      yAxis: { type: "category", data: ys, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
      },
      series: [
        {
          name: "Hours",
          type: "heatmap",
          data: heatmap.map((c) => [c.x, c.y, c.value]),
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
    const option = {
      tooltip: { trigger: "item", formatter: "{b}: {c}" },
      series: [
        {
          type: "funnel",
          left: "10%",
          width: "80%",
          data: data.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    };
    return (
      <ReactECharts
        option={option}
        style={{ height: 260, width: "100%" }}
        onEvents={{
          click: (params: any) => onSegmentClick?.(params.name, params.name),
        }}
      />
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label
            onClick={handleClick}
            style={{ cursor: onSegmentClick ? "pointer" : "default" }}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={COLORS[i % COLORS.length]}
                opacity={activeKey && (d.key || d.name) !== activeKey ? 0.35 : 1}
                stroke={activeKey === (d.key || d.name) ? "#252423" : undefined}
                strokeWidth={activeKey === (d.key || d.name) ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#118DFF"
            strokeWidth={2}
            dot={{ r: 4, fill: "#118DFF" }}
            onClick={handleClick}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar
          dataKey="value"
          fill="#118DFF"
          radius={[2, 2, 0, 0]}
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
