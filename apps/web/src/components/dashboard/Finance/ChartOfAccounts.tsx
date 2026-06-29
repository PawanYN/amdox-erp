"use client";

import { useState } from "react";

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([
    {
      code: "1000",
      name: "Cash",
      type: "Asset",
      currency: "INR",
      balance: "₹2,50,000",
    },
    {
      code: "2000",
      name: "Accounts Payable",
      type: "Liability",
      currency: "INR",
      balance: "₹1,20,000",
    },
    {
      code: "3000",
      name: "Owner Equity",
      type: "Equity",
      currency: "INR",
      balance: "₹5,00,000",
    },
    {
      code: "4000",
      name: "Sales Revenue",
      type: "Income",
      currency: "INR",
      balance: "₹3,75,000",
    },
    {
      code: "5000",
      name: "Office Expense",
      type: "Expense",
      currency: "INR",
      balance: "₹45,000",
    },
  ]);

  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "Asset",
    currency: "INR",
    balance: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    if (
      !form.code ||
      !form.name ||
      !form.type ||
      !form.currency ||
      !form.balance
    ) {
      alert("Please fill all fields");
      return;
    }

    setAccounts([
      ...accounts,
      {
        ...form,
        balance: `₹${Number(form.balance).toLocaleString("en-IN")}`,
      },
    ]);

    setForm({
      code: "",
      name: "",
      type: "Asset",
      currency: "INR",
      balance: "",
    });

    setOpen(false);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[500px] p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-5 text-gray-800">
              New Account
            </h2>

            <div className="space-y-4">
              <input
                name="code"
                placeholder="Account Code"
                value={form.code}
                onChange={handleChange}
                className="w-full border rounded-lg p-3 text-gray-700"
              />

              <input
                name="name"
                placeholder="Account Name"
                value={form.name}
                onChange={handleChange}
                className="w-full border rounded-lg p-3 text-gray-700"
              />

              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full border rounded-lg p-3 text-gray-700"
              >
                <option>Asset</option>
                <option>Liability</option>
                <option>Equity</option>
                <option>Income</option>
                <option>Expense</option>
              </select>

              <input
                name="currency"
                placeholder="Currency"
                value={form.currency}
                onChange={handleChange}
                className="w-full border rounded-lg p-3 text-gray-700"
              />

              <input
                name="balance"
                type="number"
                placeholder="Opening Balance"
                value={form.balance}
                onChange={handleChange}
                className="w-full border rounded-lg p-3 text-gray-700"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setOpen(false)}
                className="px-5 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Chart of Accounts
        </h1>

        <button
          onClick={() => setOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow"
        >
          + New Account
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-6 py-4">Account Code</th>
              <th className="text-left px-6 py-4">Account Name</th>
              <th className="text-left px-6 py-4">Type</th>
              <th className="text-left px-6 py-4">Currency</th>
              <th className="text-left px-6 py-4">Balance</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.code}
                className="border-t hover:bg-gray-50"
              >
                <td className="px-6 py-4">{account.code}</td>

                <td className="px-6 py-4">{account.name}</td>

                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                    {account.type}
                  </span>
                </td>

                <td className="px-6 py-4">{account.currency}</td>

                <td className="px-6 py-4 font-medium">
                  {account.balance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}