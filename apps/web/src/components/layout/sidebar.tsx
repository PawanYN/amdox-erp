const menuItems = [
  "Dashboard",
  "HRMS",
  "CRM",
  "Inventory",
  "Finance",
  "Reports",
  "Settings",
];
export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-8">Amdox ERP</h1>
      <div className="space-y-2">
  {menuItems.map((item, index) => (
    <div
      key={item}
      className={`px-4 py-3 rounded-lg cursor-pointer transition ${
        index === 0
          ? "bg-slate-700"
          : "hover:bg-slate-800"
      }`}
    >
      {item}
    </div>
  ))}
</div>

      
      
    </aside>
  );
}