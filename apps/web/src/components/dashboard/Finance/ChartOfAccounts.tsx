export default function ChartOfAccounts() {
  const accounts = [
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
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Chart of Accounts
        </h1>

        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow">
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

