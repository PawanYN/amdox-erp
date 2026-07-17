"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface MapeChartTheme {
  height: number;
  gridStroke: string;
  tickFontSize: number;
  tickFill: string;
  tooltipFontSize: number;
  tooltipBorder: string;
  tooltipRadius: number;
  cursorFill: string;
  barFill: string;
  barRadius: [number, number, number, number];
  barMaxSize: number;
}

export default function MapeChart({
  data,
  theme,
}: {
  data: Array<{ name: string; mape: number }>;
  theme: MapeChartTheme;
}) {
  return (
    <ResponsiveContainer width="100%" height={theme.height}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.gridStroke} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: theme.tickFontSize, fill: theme.tickFill }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: theme.tickFontSize, fill: theme.tickFill }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <Tooltip
          contentStyle={{
            fontSize: theme.tooltipFontSize,
            border: `1px solid ${theme.tooltipBorder}`,
            borderRadius: theme.tooltipRadius,
          }}
          formatter={(v) => [`${v}%`, "MAPE"]}
          cursor={{ fill: theme.cursorFill }}
        />
        <Bar
          dataKey="mape"
          fill={theme.barFill}
          radius={theme.barRadius}
          maxBarSize={theme.barMaxSize}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
