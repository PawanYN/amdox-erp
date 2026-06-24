export default function Opportunities() {
  const opportunities = [
    {
      name: "ERP Implementation",
      customer: "ABC Pvt Ltd",
      value: "₹5,00,000",
      stage: "Proposal",
    },
    {
      name: "HRMS Deployment",
      customer: "Tech Corp",
      value: "₹2,50,000",
      stage: "Negotiation",
    },
    {
      name: "Inventory Automation",
      customer: "XYZ Solutions",
      value: "₹7,00,000",
      stage: "Won",
    },
  ];

  return (
    <div className="p-8 bg-gray-100 min-h-screen w-full">
      <h1 className="text-3xl font-bold text-black mb-6">
        Opportunities
      </h1>

      <div className="bg-white rounded-xl shadow border">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left text-black">Opportunity</th>
              <th className="p-4 text-left text-black">Customer</th>
              <th className="p-4 text-left text-black">Value</th>
              <th className="p-4 text-left text-black">Stage</th>
            </tr>
          </thead>

          <tbody>
            {opportunities.map((item) => (
              <tr key={item.name} className="border-t">
                <td className="p-4 text-black">{item.name}</td>
                <td className="p-4 text-black">{item.customer}</td>
                <td className="p-4 text-black">{item.value}</td>
                <td className="p-4 text-black">{item.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}