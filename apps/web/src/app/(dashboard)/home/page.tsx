export default function DashboardHome() {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-white">
      <div className="text-center max-w-xs">
        <div className="mx-auto h-11 w-11 rounded-lg border border-dashed border-[#D8D5CC] flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-[#D8D5CC]" />
        </div>
        <p className="mt-4 text-[#14171F] font-medium text-sm">Dashboard Home</p>
        <p className="mt-1 text-xs text-[#8A8678]">
          Welcome! Select a module from the sidebar to get started.
        </p>
      </div>
    </div>
  );
}
