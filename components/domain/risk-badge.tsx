import { cn, riskTone, type RiskLevel } from "@/lib/utils";

export function RiskBadge({
  level,
  className,
}: {
  level: RiskLevel | string | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        riskTone(level),
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level ?? "unknown"} risk
    </span>
  );
}

export function ConfidenceBadge({ level }: { level?: string }) {
  const tone =
    level === "high"
      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-500"
      : level === "medium"
        ? "bg-amber-500/10 border-amber-500/25 text-amber-500"
        : "bg-muted border-border text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        tone,
      )}
    >
      Confidence · {level ?? "—"}
    </span>
  );
}
