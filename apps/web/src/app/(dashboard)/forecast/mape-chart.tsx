"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function MapeChart({ data }: { data: Array<{ name: string; mape: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <Tooltip
          contentStyle={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}
          formatter={(v) => [`${v}%`, "MAPE"]}
          cursor={{ fill: "#eff6ff" }}
        />
        <Bar dataKey="mape" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
