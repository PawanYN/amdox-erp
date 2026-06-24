export default function Invoices() {
  const invoices = [
    {
      invoiceNo: "INV-001",
      customer: "ABC Pvt Ltd",
      amount: "₹45,000",
      status: "Paid",
    },
    {
      invoiceNo: "INV-002",
      customer: "XYZ Solutions",
      amount: "₹80,000",
      status: "Pending",
    },
    {
      invoiceNo: "INV-003",
      customer: "Tech Corp",
      amount: "₹25,000",
      status: "Overdue",
    },
  ];

  return (
    <div className="p-8 bg-gray-100 min-h-screen w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">
          Invoices (AP/AR)
        </h1>

        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left text-black">Invoice No</th>
              <th className="p-4 text-left text-black">Customer</th>
              <th className="p-4 text-left text-black">Amount</th>
              <th className="p-4 text-left text-black">Status</th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.invoiceNo} className="border-t">
                <td className="p-4 text-black">{invoice.invoiceNo}</td>
                <td className="p-4 text-black">{invoice.customer}</td>
                <td className="p-4 text-black">{invoice.amount}</td>
                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      invoice.status === "Paid"
                        ? "bg-green-100 text-green-700"
                        : invoice.status === "Pending"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
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