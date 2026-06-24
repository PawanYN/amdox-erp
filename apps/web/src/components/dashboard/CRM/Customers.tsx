export default function Customers() {
  const customers = [
    {
      id: "CUST-001",
      name: "ABC Pvt Ltd",
      contact: "Rahul Sharma",
      status: "Active",
    },
    {
      id: "CUST-002",
      name: "Tech Corp",
      contact: "Priya Verma",
      status: "Active",
    },
    {
      id: "CUST-003",
      name: "XYZ Solutions",
      contact: "Amit Singh",
      status: "Inactive",
    },
  ];

  return (
    <div className="p-8 bg-gray-100 min-h-screen w-full">
      <h1 className="text-3xl font-bold text-black mb-6">
        Customers
      </h1>

      <div className="bg-white rounded-xl shadow border">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left text-black">Customer ID</th>
              <th className="p-4 text-left text-black">Customer Name</th>
              <th className="p-4 text-left text-black">Contact Person</th>
              <th className="p-4 text-left text-black">Status</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t">
                <td className="p-4 text-black">{customer.id}</td>
                <td className="p-4 text-black">{customer.name}</td>
                <td className="p-4 text-black">{customer.contact}</td>
                <td className="p-4 text-black">{customer.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}