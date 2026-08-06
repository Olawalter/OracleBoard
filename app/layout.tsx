import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "OracleBoard AI — Consensus Due Diligence on GenLayer",
  description:
    "Public-project due diligence resolved by independent AI validators reaching on-chain consensus on GenLayer.",
  metadataBase: new URL("https://oracleboard.ai"),
  openGraph: {
    title: "OracleBoard AI",
    description:
      "Public-project due diligence resolved by independent AI validators reaching on-chain consensus on GenLayer.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <Toaster>
          <AppShell>{children}</AppShell>
        </Toaster>
      </body>
    </html>
  );
}
