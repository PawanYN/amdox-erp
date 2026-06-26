"use client";

import { useState } from "react";

type JournalEntry = {
  id: string;
  date: string;
  description: string;
  debit: string;
  credit: string;
  amount: string;
  locked: boolean;
};

export default function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([
    {
      id: "JE-001",
      date: "2026-06-20",
      description: "Office Rent Payment",
      debit: "Rent Expense",
      credit: "Cash",
      amount: "₹50,000",
      locked: true,
    },
    {
      id: "JE-002",
      date: "2026-06-21",
      description: "Vendor Invoice",
      debit: "Inventory",
      credit: "Accounts Payable",
      amount: "₹25,000",
      locked: false,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    date: "",
    description: "",
    debit: "",
    credit: "",
    amount: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = () => {
    if (Object.values(form).some(v => !v)) {
      alert("Please fill all fields");
      return;
    }
    setEntries([
      ...entries,
      {
        id: `JE-${String(entries.length + 1).padStart(3, "0")}`,
        ...form,
        amount: `₹${Number(form.amount).toLocaleString("en-IN")}`,
        locked: false,
      },
    ]);
    setForm({ date:"",description:"",debit:"",credit:"",amount:""});
    setShowModal(false);
  };

  const filtered = entries.filter(e =>
    [e.id,e.description,e.debit,e.credit].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-[500px]">
            <h2 className="text-2xl font-bold mb-4">New Journal Entry</h2>
            <div className="space-y-3">
              <input className="w-full border p-3 rounded" type="date" name="date" value={form.date} onChange={handleChange}/>
              <input className="w-full border p-3 rounded" placeholder="Description" name="description" value={form.description} onChange={handleChange}/>
              <input className="w-full border p-3 rounded" placeholder="Debit Account" name="debit" value={form.debit} onChange={handleChange}/>
              <input className="w-full border p-3 rounded" placeholder="Credit Account" name="credit" value={form.credit} onChange={handleChange}/>
              <input className="w-full border p-3 rounded" type="number" placeholder="Amount" name="amount" value={form.amount} onChange={handleChange}/>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={()=>setShowModal(false)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Journal Entries</h1>
        <button onClick={()=>setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg">+ New Journal Entry</button>
      </div>

      <input
        className="border rounded-lg p-3 mb-4 w-full"
        placeholder="Search..."
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Debit</th>
              <th className="p-3 text-left">Credit</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry=>(
              <tr key={entry.id} className="border-t">
                <td className="p-3">{entry.id}</td>
                <td className="p-3">{entry.date}</td>
                <td className="p-3">{entry.description}</td>
                <td className="p-3">{entry.debit}</td>
                <td className="p-3">{entry.credit}</td>
                <td className="p-3">{entry.amount}</td>
                <td className="p-3">
                  {entry.locked
                    ? <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full">🔒 Locked</span>
                    : <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full">Editable</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
