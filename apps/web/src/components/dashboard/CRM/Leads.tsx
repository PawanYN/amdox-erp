export default function Leads() {
  const leads = [
    {
      name: "Rahul Sharma",
      company: "ABC Pvt Ltd",
      status: "New",
    },
    {
      name: "Priya Verma",
      company: "Tech Corp",
      status: "Contacted",
    },
    {
      name: "Amit Singh",
      company: "XYZ Solutions",
      status: "Qualified",
    },
  ];

  return (
    <div className="p-8 bg-gray-100 min-h-screen w-full">
      <h1 className="text-3xl font-bold text-black mb-6">
        CRM Leads
      </h1>

      <div className="bg-white rounded-xl shadow border">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left text-black">Lead Name</th>
              <th className="p-4 text-left text-black">Company</th>
              <th className="p-4 text-left text-black">Status</th>
            </tr>
          </thead>

          <tbody>
            {leads.map((lead) => (
              <tr key={lead.name} className="border-t">
                <td className="p-4 text-black">{lead.name}</td>
                <td className="p-4 text-black">{lead.company}</td>
                <td className="p-4 text-black">{lead.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}