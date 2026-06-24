export default function ChartOfAccounts() {
  const accounts = [
    {
      code: "1000",
      name: "Cash",
      type: "Asset",
    },
    {
      code: "2000",
      name: "Accounts Payable",
      type: "Liability",
    },
    {
      code: "3000",
      name: "Sales Revenue",
      type: "Revenue",
    },
    {
      code: "4000",
      name: "Office Expenses",
      type: "Expense",
    },
  ];

  return (
   <div className="p-8 bg-white min-h-screen w-full">
      <h1 className="text-4xl font-bold mb-6 text-slate-900">
        Chart of Accounts
      </h1>

      <div className="bg-white border rounded-lg shadow w-full">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 border-b">
              <th className="p-4 text-left text-slate-900">Code</th>
              <th className="p-4 text-left text-slate-900">
                Account Name
              </th>
              <th className="p-4 text-left text-slate-900">Type</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.code}
                className="border-b hover:bg-slate-50"
              >
                <td className="p-4 text-slate-900">
                  {account.code}
                </td>

                <td className="p-4 text-slate-900">
                  {account.name}
                </td>

                <td className="p-4 text-slate-900">
                  {account.type}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Add Account
        </button>
      </div>
    </div>
  );
}