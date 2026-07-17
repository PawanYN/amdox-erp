import DashboardLayoutClient from "@/components/layout/dashboard-layout-client";
import { KeycloakProvider } from "@/components/layout/keycloak-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <KeycloakProvider requireAuth>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </KeycloakProvider>
  );
}
