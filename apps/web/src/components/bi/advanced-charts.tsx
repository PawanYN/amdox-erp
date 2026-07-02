"use client";

import dynamic from "next/dynamic";
import { PBI_CHART_COLORS } from "./power-bi-theme";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type GaugeChartProps = {
  value: number;
  max?: number;
  title?: string;
  format?: "number" | "percent" | "currency";
};

export function GaugeChart({ value, max = 100, title, format = "number" }: GaugeChartProps) {
  const displayValue =
    format === "percent"
      ? `${value.toFixed(1)}%`
      : format === "currency"
        ? `₹${value.toLocaleString()}`
        : value.toLocaleString();

  const option = {
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max,
        splitNumber: 4,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.3, "#fd666d"],
              [0.7, "#37d4cf"],
              [1, "#3fb950"],
            ],
          },
        },
        pointer: {
          itemStyle: {
            color: "inherit",
          },
        },
        axisTick: {
          distance: -20,
          length: 5,
          lineStyle: {
            color: "#fff",
            width: 1,
          },
        },
        splitLine: {
          distance: -25,
          length: 15,
          lineStyle: {
            color: "#fff",
            width: 2,
          },
        },
        axisLabel: {
          color: "inherit",
          distance: 30,
          fontSize: 11,
        },
        detail: {
          valueAnimation: true,
          formatter: displayValue,
          color: "inherit",
          fontSize: 24,
          offsetCenter: [0, "70%"],
        },
        data: [
          {
            value,
            name: title || "",
          },
        ],
        title: {
          fontSize: 13,
          color: "#605E5C",
          offsetCenter: [0, "95%"],
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 240, width: "100%" }} />;
}

type CardKpiProps = {
  title: string;
  value: number | string;
  change?: number;
  trend?: "up" | "down" | "neutral";
  format?: "number" | "percent" | "currency";
  icon?: React.ReactNode;
};

export function CardKpi({ title, value, change, trend, format = "number", icon }: CardKpiProps) {
  const displayValue =
    typeof value === "number"
      ? format === "percent"
        ? `${value.toFixed(1)}%`
        : format === "currency"
          ? `₹${value.toLocaleString()}`
          : value.toLocaleString()
      : value;

  const trendColor =
    trend === "up" ? "#107C10" : trend === "down" ? "#D13438" : "#605E5C";

  return (
    <div className="h-full flex flex-col justify-between p-4">
      <div className="flex items-start justify-between">
        <div className="text-[13px] font-medium text-[#605E5C]">{title}</div>
        {icon && <div className="text-[#118DFF]">{icon}</div>}
      </div>
      <div className="flex-1 flex items-center">
        <div className="text-[42px] font-semibold text-[#252423] leading-none">
          {displayValue}
        </div>
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: trendColor }}>
          <span className="font-semibold">
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
          <span className="text-[#605E5C]">vs last period</span>
        </div>
      )}
    </div>
  );
}

type WaterfallChartProps = {
  data: { name: string; value: number; isTotal?: boolean }[];
};

export function WaterfallChart({ data }: WaterfallChartProps) {
  const option = {
    title: {
      show: false,
    },
    grid: {
      left: 60,
      right: 20,
      top: 20,
      bottom: 60,
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.name),
      axisLabel: {
        rotate: 45,
        fontSize: 10,
      },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        fontSize: 10,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: (params: any) => {
        const point = params[0];
        return `${point.name}<br/>${point.seriesName}: ₹${Math.abs(point.value).toLocaleString()}`;
      },
    },
    series: [
      {
        name: "Amount",
        type: "bar",
        stack: "total",
        itemStyle: {
          borderColor: "transparent",
          color: (params: any) => {
            const isTotal = data[params.dataIndex]?.isTotal;
            if (isTotal) return "#118DFF";
            return data[params.dataIndex].value >= 0 ? "#107C10" : "#D13438";
          },
        },
        data: data.map((d, i) => {
          if (d.isTotal) return d.value;
          let sum = 0;
          for (let j = 0; j < i; j++) {
            if (!data[j].isTotal) sum += data[j].value;
          }
          return sum;
        }),
      },
      {
        name: "Change",
        type: "bar",
        stack: "total",
        itemStyle: {
          color: (params: any) => {
            const isTotal = data[params.dataIndex]?.isTotal;
            if (isTotal) return "transparent";
            return data[params.dataIndex].value >= 0 ? "#107C10" : "#D13438";
          },
        },
        data: data.map((d) => (d.isTotal ? 0 : d.value)),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}

type ScatterChartProps = {
  data: { name: string; x: number; y: number; size?: number }[];
  xLabel?: string;
  yLabel?: string;
};

export function ScatterChart({ data, xLabel, yLabel }: ScatterChartProps) {
  const option = {
    grid: {
      left: 60,
      right: 40,
      top: 40,
      bottom: 60,
    },
    xAxis: {
      name: xLabel,
      nameLocation: "center",
      nameGap: 35,
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      name: yLabel,
      nameLocation: "center",
      nameGap: 40,
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 10 },
    },
    tooltip: {
      formatter: (params: any) => {
        return `${params.data.name}<br/>X: ${params.data.value[0]}<br/>Y: ${params.data.value[1]}`;
      },
    },
    series: [
      {
        type: "scatter",
        symbolSize: (data: any) => data.size || 10,
        data: data.map((d) => ({
          name: d.name,
          value: [d.x, d.y],
          size: d.size,
        })),
        itemStyle: {
          color: PBI_CHART_COLORS[0],
          opacity: 0.7,
        },
        emphasis: {
          itemStyle: {
            opacity: 1,
          },
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}

type TreemapChartProps = {
  data: { name: string; value: number; children?: { name: string; value: number }[] }[];
};

export function TreemapChart({ data }: TreemapChartProps) {
  const option = {
    tooltip: {
      formatter: (params: any) => {
        return `${params.name}<br/>Value: ${params.value.toLocaleString()}`;
      },
    },
    series: [
      {
        type: "treemap",
        width: "100%",
        height: "100%",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          fontSize: 11,
          formatter: (params: any) => {
            return `${params.name}\n${params.value.toLocaleString()}`;
          },
        },
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 2,
        },
        levels: [
          {
            itemStyle: {
              borderColor: "#fff",
              borderWidth: 2,
            },
          },
          {
            colorSaturation: [0.35, 0.5],
            itemStyle: {
              borderWidth: 1,
            },
          },
        ],
        data: data.map((d, i) => ({
          name: d.name,
          value: d.value,
          itemStyle: {
            color: PBI_CHART_COLORS[i % PBI_CHART_COLORS.length],
          },
          children: d.children?.map((c, j) => ({
            name: c.name,
            value: c.value,
            itemStyle: {
              color: PBI_CHART_COLORS[i % PBI_CHART_COLORS.length],
            },
          })),
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260, width: "100%" }} />;
}
