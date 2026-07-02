import DashboardLayout from "@/components/layout/dashboardLayout";
import { KeycloakProvider } from "@/components/KeycloakProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <KeycloakProvider requireAuth>
      <DashboardLayout>{children}</DashboardLayout>
    </KeycloakProvider>
  );
}
