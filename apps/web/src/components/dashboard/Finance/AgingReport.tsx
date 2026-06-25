"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function AgingReport() {
  const agingData = [
    { name: "0-30 Days", value: 250000 },
    { name: "31-60 Days", value: 175000 },
    { name: "61-90 Days", value: 95000 },
    { name: "90+ Days", value: 60000 },
  ];

  const COLORS = [
    "#1E40AF", // Blue
    "#059669", // Green
    "#D97706", // Orange
    "#7C3AED", // Purple
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-black">
      <h1 className="text-4xl font-bold mb-2">Aging Report</h1>

      <p className="text-gray-500 mb-8">
        Outstanding customer balances grouped by aging bucket
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow border">
          <h3 className="text-gray-500 text-sm">0 - 30 Days</h3>
          <p className="text-3xl font-bold text-blue-700 mt-2">
            ₹2,50,000
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border">
          <h3 className="text-gray-500 text-sm">31 - 60 Days</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            ₹1,75,000
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border">
          <h3 className="text-gray-500 text-sm">61 - 90 Days</h3>
          <p className="text-3xl font-bold text-orange-500 mt-2">
            ₹95,000
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border">
          <h3 className="text-gray-500 text-sm">90+ Days</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            ₹60,000
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-xl shadow border">
        <h2 className="text-2xl font-semibold mb-6">
          Aging Distribution
        </h2>

        <div className="h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={agingData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={150}
                label={({ name }: any) => name}
              >
                {agingData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>

              <Tooltip
              formatter={(value: any) =>
                `₹${Number(value).toLocaleString("en-IN")}`
            }
              />

              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}