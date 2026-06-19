export default function Navbar() {
  return (
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
  );
}