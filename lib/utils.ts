import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(addr?: string | null, head = 6, tail = 4) {
  if (!addr) return "";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatTimestamp(ts?: number | null) {
  if (!ts) return "—";
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "severe";
export const RISK_LEVELS: RiskLevel[] = ["low", "moderate", "elevated", "high", "severe"];

export function riskTone(level: RiskLevel | string | undefined) {
  switch (level) {
    case "low":
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "moderate":
      return "text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "elevated":
      return "text-orange-600 dark:text-orange-300 bg-orange-500/10 border-orange-500/20";
    case "high":
      return "text-rose-600 dark:text-rose-300 bg-rose-500/10 border-rose-500/20";
    case "severe":
      return "text-red-700 dark:text-red-300 bg-red-500/15 border-red-500/25";
    default:
      return "text-muted-foreground bg-muted border-border";
  }
}
