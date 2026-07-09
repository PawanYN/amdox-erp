import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import "../styles/grid-layout.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { QueryProvider } from "../lib/providers/query-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Amdox ERP Suite",
  description: "AI-powered cloud enterprise resource planning suite",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Nearly every page fires an XHR to the API immediately on load
            (BI KPIs, dashboards, reports, etc.) — preconnect so the TCP/TLS
            handshake happens during page load instead of on first request.
            Found via Lighthouse's uses-rel-preconnect audit on /bi. */}
        <link rel="preconnect" href={apiUrl} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
