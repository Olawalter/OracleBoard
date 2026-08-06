import { AlertTriangle, CheckCircle2, ListChecks, MinusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ConfidenceBadge, RiskBadge } from "./risk-badge";
import type { Verdict } from "@/lib/genlayer/oracleboard";
import { formatTimestamp } from "@/lib/utils";

export function VerdictCard({ verdict }: { verdict: Verdict }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-6 py-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <span>Accepted consensus verdict</span>
        <span className="font-mono">{formatTimestamp(verdict.finalized_at)}</span>
      </div>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <RiskBadge level={verdict.overall_risk} />
          <ConfidenceBadge level={verdict.confidence} />
        </div>
        <CardTitle className="text-2xl leading-snug">{verdict.summary || "No summary provided."}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Evidence coverage</span>
            <span className="font-mono">{verdict.evidence_coverage}%</span>
          </div>
          <Progress value={verdict.evidence_coverage} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={CheckCircle2} label="Supported claims" value={verdict.supported_claims} tone="positive" />
          <Stat icon={MinusCircle} label="Unsupported claims" value={verdict.unsupported_claims} tone="warning" />
          <Stat icon={AlertTriangle} label="Contradictions" value={verdict.contradictions} tone="danger" />
        </div>
        {verdict.material_risks.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Material risks
            </div>
            <ul className="grid gap-2">
              {verdict.material_risks.map((r, i) => (
                <li
                  key={i}
                  className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-100"
                >
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {verdict.follow_up.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" /> Recommended follow-up
            </div>
            <ul className="grid gap-2">
              {verdict.follow_up.map((f, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "warning"
        ? "text-amber-500"
        : "text-rose-500";
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} /> {label}
      </div>
      <div className="mt-2 font-serif text-3xl tracking-tight">{value}</div>
    </div>
  );
}
