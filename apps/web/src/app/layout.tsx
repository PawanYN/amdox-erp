import type { Metadata } from "next";
import "../styles/globals.css";

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
        {children}
      </body>
    </html>
  );
}
