"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function StockForecastChart({
  data,
}: {
  data: Array<{ date: string; qty: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={90}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE7" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "#8A8678" }}
          interval={Math.floor(data.length / 5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "#8A8678" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 11,
            border: "1px solid #E4E2DC",
            borderRadius: 6,
            padding: "4px 8px",
          }}
          formatter={(v) => [`${v} units`, "Forecast"]}
          cursor={{ fill: "#1E3A5F10" }}
        />
        <Bar dataKey="qty" fill="#1E3A5F" radius={[2, 2, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
