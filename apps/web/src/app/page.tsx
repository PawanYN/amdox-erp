export default function Home() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-6">
        <h1 className="text-2xl font-bold mb-8">Amdox ERP</h1>

        <div className="space-y-2">

  <div className="bg-slate-700 px-4 py-3 rounded-lg cursor-pointer">
    Dashboard
  </div>

  <div className="hover:bg-slate-800 px-4 py-3 rounded-lg cursor-pointer transition">
    HRMS
  </div>

  <div className="hover:bg-slate-800 px-4 py-3 rounded-lg cursor-pointer transition">
    CRM
  </div>

  <div className="hover:bg-slate-800 px-4 py-3 rounded-lg cursor-pointer transition">
    Inventory
  </div>

  <div className="hover:bg-slate-800 px-4 py-3 rounded-lg cursor-pointer transition">
    Finance
  </div>

  <div className="hover:bg-slate-800 px-4 py-3 rounded-lg cursor-pointer transition">
    Reports
  </div>

  <div className="hover:bg-slate-800 px-4 py-3 rounded-lg cursor-pointer transition">
    Settings
  </div>

</div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100">
  
  {/* Navbar */}
  <div className="flex justify-between items-center bg-white px-8 py-4 shadow">
    <input
      type="text"
      placeholder="Search..."
      className="border border-gray-300 rounded-lg px-4 py-2 w-80"
    />

    <div className="flex items-center gap-6">
      <span className="text-xl">🔔</span>
      <span className="font-medium text-black">Profile</span>
    </div>
  </div>

  {/* Dashboard Content */}
  <div className="p-8">
  <h1 className="text-3xl font-bold text-black">Dashboard</h1>

  <p className="text-gray-600 mt-2">
    Welcome to Amdox ERP
  </p>

  <div className="grid grid-cols-4 gap-6 mt-8">

    <div className="bg-white p-6 rounded-xl shadow">
      <h3 className="text-gray-500">Employees</h3>
      <p className="text-3xl font-bold text-black">125</p>
    </div>

    <div className="bg-white p-6 rounded-xl shadow">
      <h3 className="text-gray-500">Customers</h3>
      <p className="text-3xl font-bold text-black">432</p>
    </div>

    <div className="bg-white p-6 rounded-xl shadow">
      <h3 className="text-gray-500">Projects</h3>
      <p className="text-3xl font-bold text-black">18</p>
    </div>

    <div className="bg-white p-6 rounded-xl shadow">
      <h3 className="text-gray-500">Revenue</h3>
      <p className="text-3xl font-bold text-black">₹8.4L</p>
    </div>

  </div>
</div>

</main>
    </div>
  );
}