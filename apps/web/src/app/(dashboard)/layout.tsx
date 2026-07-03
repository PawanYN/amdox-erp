import DashboardLayoutClient from "@/components/layout/DashboardLayoutClient";
import { KeycloakProvider } from "@/components/KeycloakProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <KeycloakProvider requireAuth>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </KeycloakProvider>
  );
}
