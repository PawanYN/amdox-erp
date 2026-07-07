"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function MapeChart({ data }: { data: Array<{ name: string; mape: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE7" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9, fill: "#8A8678" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 9, fill: "#8A8678" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={{ fontSize: 11, border: "1px solid #E4E2DC", borderRadius: 6 }}
          formatter={(v) => [`${v}%`, "MAPE"]}
          cursor={{ fill: "#1E3A5F10" }}
        />
        <Bar dataKey="mape" radius={[2, 2, 0, 0]} maxBarSize={24} fill="#1E3A5F" />
      </BarChart>
    </ResponsiveContainer>
  );
}
