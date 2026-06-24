"use client";

import { useState } from "react";

export default function Invoices() {
  const [tab, setTab] = useState("Payable");

  const payableInvoices = [
    {
      id: "AP-001",
      vendor: "ABC Suppliers",
      amount: "₹45,000",
      date: "2026-06-20",
      status: "Matched",
    },
    {
      id: "AP-002",
      vendor: "XYZ Traders",
      amount: "₹80,000",
      date: "2026-06-21",
      status: "Pending",
    },
    {
      id: "AP-003",
      vendor: "Global Tech",
      amount: "₹25,000",
      date: "2026-06-22",
      status: "Mismatch",
    },
  ];

  const receivableInvoices = [
    {
      id: "AR-001",
      customer: "Tech Corp",
      amount: "₹1,20,000",
      date: "2026-06-18",
      status: "Paid",
    },
    {
      id: "AR-002",
      customer: "Future Pvt Ltd",
      amount: "₹95,000",
      date: "2026-06-19",
      status: "Open",
    },
    {
      id: "AR-003",
      customer: "Vision Ltd",
      amount: "₹40,000",
      date: "2026-06-15",
      status: "Overdue",
    },
  ];

  const invoices =
    tab === "Payable" ? payableInvoices : receivableInvoices;

  const badgeColor = (status: string) => {
    switch (status) {
      case "Matched":
      case "Paid":
        return "bg-green-100 text-green-700";

      case "Mismatch":
      case "Overdue":
        return "bg-red-100 text-red-700";

      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Invoices (AP / AR)
        </h1>

        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          + New Invoice
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTab("Payable")}
          className={`px-4 py-2 rounded-lg ${
            tab === "Payable"
              ? "bg-blue-600 text-white"
              : "bg-white border"
          }`}
        >
          Payable
        </button>

        <button
          onClick={() => setTab("Receivable")}
          className={`px-4 py-2 rounded-lg ${
            tab === "Receivable"
              ? "bg-blue-600 text-white"
              : "bg-white border"
          }`}
        >
          Receivable
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Invoice ID</th>
              <th className="px-4 py-3 text-left">
                {tab === "Payable"
                  ? "Vendor"
                  : "Customer"}
              </th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-t hover:bg-gray-50"
              >
                <td className="px-4 py-3">{invoice.id}</td>

                <td className="px-4 py-3">
                  {"vendor" in invoice
                    ? invoice.vendor
                    : invoice.customer}
                </td>

                <td className="px-4 py-3">
                  {invoice.amount}
                </td>

                <td className="px-4 py-3">
                  {invoice.date}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${badgeColor(
                      invoice.status
                    )}`}
                  >
                    {invoice.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}