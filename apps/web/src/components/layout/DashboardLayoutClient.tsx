"use client";

import dynamic from "next/dynamic";

const DashboardLayout = dynamic(
  () => import("@/components/layout/dashboardLayout"),
  { ssr: false }
);

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
