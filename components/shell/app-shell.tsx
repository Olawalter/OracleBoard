"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircuitBoard, FileSignature, Gavel, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLIENT_CHAIN } from "@/lib/genlayer/config";
import { WalletIdentityBar } from "@/components/shell/wallet-identity-bar";

const NAV = [
  { href: "/submissions", label: "Submissions", icon: FileSignature },
  { href: "/consensus", label: "Consensus", icon: Radar },
  { href: "/report", label: "Reports", icon: Gavel },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 grid-lines opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--accent)/0.18)_0%,transparent_70%)]"
      />
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative">
              <CircuitBoard className="h-6 w-6 text-accent" />
              <span className="absolute -inset-1 -z-10 rounded-full bg-accent/20 blur-md" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif text-lg tracking-tight">OracleBoard</span>
              <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Consensus DD · GenLayer
              </span>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-secondary text-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <WalletIdentityBar />
            <Button asChild size="sm" variant="accent">
              <Link href="/submissions/new">Submit dossier</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="container relative pb-24 pt-8 md:pt-12">{children}</main>
      <footer className="border-t border-border/70">
        <div className="container flex flex-col items-start justify-between gap-4 py-8 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>
            OracleBoard AI · Consensus due diligence built on{" "}
            <a
              href="https://genlayer.com"
              className="text-foreground underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              GenLayer
            </a>
            .
          </div>
          <div className="flex items-center gap-4">
            <span>Chain · {CLIENT_CHAIN}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
