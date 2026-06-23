export default function JournalEntries() {
  const entries = [
    {
      id: "JE-001",
      date: "2026-06-20",
      description: "Office Rent Payment",
      amount: "₹50,000",
      status: "Posted",
    },
    {
      id: "JE-002",
      date: "2026-06-21",
      description: "Vendor Invoice",
      amount: "₹25,000",
      status: "Draft",
    },
    {
      id: "JE-003",
      date: "2026-06-22",
      description: "Salary Expense",
      amount: "₹1,20,000",
      status: "Posted",
    },
  ];

  return (
    <div className="p-8 bg-gray-100 min-h-screen w-full text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">
          Journal Entries
        </h1>

        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Create Entry
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left text-slate-800 font-semibold">
                Entry ID
              </th>
              <th className="p-4 text-left text-slate-800 font-semibold">
                Date
              </th>
              <th className="p-4 text-left text-slate-800 font-semibold">
                Description
              </th>
              <th className="p-4 text-left text-slate-800 font-semibold">
                Amount
              </th>
              <th className="p-4 text-left text-slate-800 font-semibold">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-t hover:bg-gray-50 transition"
              >
                <td className="p-4 text-slate-900 font-medium">
                  {entry.id}
                </td>

                <td className="p-4 text-slate-700">
                  {entry.date}
                </td>

                <td className="p-4 text-slate-700">
                  {entry.description}
                </td>

                <td className="p-4 text-slate-700 font-medium">
                  {entry.amount}
                </td>

                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      entry.status === "Posted"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {entry.status}
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