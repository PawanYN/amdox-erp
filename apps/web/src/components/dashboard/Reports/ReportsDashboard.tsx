export default function ReportsDashboard() {
  const stats = [
    {
      title: "Total Revenue",
      value: "₹25,00,000",
    },
    {
      title: "Customers",
      value: "128",
    },
    {
      title: "Employees",
      value: "54",
    },
    {
      title: "Projects",
      value: "16",
    },
  ];

  return (
    <div className="p-8 bg-gray-100 min-h-screen w-full">
      <h1 className="text-3xl font-bold text-black mb-6">
        Reports Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((item) => (
          <div
            key={item.title}
            className="bg-white p-6 rounded-xl shadow border"
          >
            <h2 className="text-gray-500 text-sm">
              {item.title}
            </h2>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow border p-6 mt-8">
        <h2 className="text-xl font-semibold text-black mb-4">
          Revenue Summary
        </h2>
        <div className="bg-white rounded-xl shadow border p-6 mt-6">
  <h2 className="text-xl font-semibold text-black mb-4">
    Recent Activities
  </h2>

  <ul className="space-y-3 text-black">
    <li>✓ Invoice INV-001 approved</li>
    <li>✓ New CRM lead created</li>
    <li>✓ Employee payroll processed</li>
    <li>✓ Purchase Order PO-100 approved</li>
  </ul>
</div>

        <div className="h-64 flex items-center justify-center text-gray-500">
          Revenue Chart Placeholder
        </div>
      </div>
    </div>
  );
}