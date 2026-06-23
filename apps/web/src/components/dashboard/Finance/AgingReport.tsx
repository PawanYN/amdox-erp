export default function AgingReport() {
  const reports = [
    {
      customer: "ABC Pvt Ltd",
      amount: "₹45,000",
      days: 15,
    },
    {
      customer: "XYZ Solutions",
      amount: "₹80,000",
      days: 45,
    },
    {
      customer: "Tech Corp",
      amount: "₹25,000",
      days: 90,
    },
  ];

  return (
    <div className="p-8 bg-gray-100 min-h-screen w-full">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">
        Aging Report
      </h1>

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left text-black">Customer</th>
              <th className="p-4 text-left text-black">Outstanding Amount</th>
              <th className="p-4 text-left text-black">Days Due</th>
            </tr>
          </thead>

          <tbody>
            {reports.map((item) => (
              <tr key={item.customer} className="border-t">
                <td className="p-4 text-black">{item.customer}</td>
                <td className="p-4 text-black">{item.amount}</td>
                <td className="p-4 text-black">{item.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}