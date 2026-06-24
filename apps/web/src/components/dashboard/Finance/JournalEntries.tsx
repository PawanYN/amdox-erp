export default function JournalEntries() {
  const entries = [
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
    {
      id: "JE-003",
      date: "2026-06-22",
      description: "Salary Expense",
      debit: "Salary Expense",
      credit: "Cash",
      amount: "₹1,20,000",
      locked: true,
    },
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Journal Entries
        </h1>

        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow">
          + New Journal Entry
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Entry ID</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Debit</th>
              <th className="px-4 py-3 text-left">Credit</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-t hover:bg-gray-50"
              >
                <td className="px-4 py-3">{entry.id}</td>
                <td className="px-4 py-3">{entry.date}</td>
                <td className="px-4 py-3">{entry.description}</td>
                <td className="px-4 py-3">{entry.debit}</td>
                <td className="px-4 py-3">{entry.credit}</td>
                <td className="px-4 py-3 font-semibold">
                  {entry.amount}
                </td>

                <td className="px-4 py-3">
                  {entry.locked ? (
                    <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm">
                      🔒 Locked
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm">
                      Editable
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}