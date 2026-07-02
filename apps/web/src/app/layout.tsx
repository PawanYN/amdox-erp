import type { Metadata } from "next";
import "../styles/globals.css";
import { KeycloakProvider } from "../components/KeycloakProvider";
import { QueryProvider } from "../lib/providers/query-provider";

export const metadata: Metadata = {
  title: "Amdox ERP Suite",
  description: "AI-powered cloud enterprise resource planning suite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <KeycloakProvider>
          <QueryProvider>{children}</QueryProvider>
        </KeycloakProvider>
      </body>
    </html>
  );
}
