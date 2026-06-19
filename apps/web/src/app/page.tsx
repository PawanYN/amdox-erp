import Navbar from "../components/layout/navbar";
import Sidebar from "../components/layout/sidebar";

export default function Home() {
  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="flex-1 bg-gray-100">
        <Navbar />

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