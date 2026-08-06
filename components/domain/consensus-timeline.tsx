import { Cpu, Flag, Gavel, Send } from "lucide-react";
import type { Challenge, Submission, Verdict } from "@/lib/genlayer/oracleboard";
import { formatTimestamp, shortAddress } from "@/lib/utils";

export function ConsensusTimeline({
  submission,
  verdict,
  challenge,
}: {
  submission: Submission;
  verdict: Verdict | null;
  challenge: Challenge | null;
}) {
  const events: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    detail: string;
    ts?: number;
    tone: "accent" | "muted" | "warn" | "success";
  }[] = [
    {
      icon: Send,
      label: "Submitted",
      detail: `${shortAddress(submission.submitter, 8, 6)} opened the dossier`,
      ts: submission.created_at,
      tone: "accent",
    },
    {
      icon: Cpu,
      label: "Validator execution",
      detail: verdict
        ? "Independent validators fetched every cited URL, graded the eight dimensions and emitted signed verdicts."
        : "Awaiting evaluate() call. Any client can trigger validator execution.",
      tone: verdict ? "muted" : "warn",
      ts: undefined,
    },
    {
      icon: Gavel,
      label: verdict ? "Consensus accepted" : "Consensus pending",
      detail: verdict
        ? `Overall risk ${verdict.overall_risk} · confidence ${verdict.confidence}`
        : "Verdicts must agree on the bucketed signature before the contract will store them.",
      tone: verdict ? "success" : "muted",
      ts: verdict?.finalized_at,
    },
  ];
  if (challenge) {
    events.push({
      icon: Flag,
      label: challenge.resolved ? "Challenge resolved" : "Challenge open",
      detail: `${challenge.kind === "new_evidence" ? "New evidence" : "Factual error"} raised by ${shortAddress(challenge.challenger, 6, 4)}`,
      tone: challenge.resolved ? "success" : "warn",
      ts: challenge.created_at,
    });
  }

  return (
    <ol className="relative border-l border-border pl-6">
      {events.map((e, i) => (
        <li key={i} className="mb-6 last:mb-0">
          <span
            className={
              "absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-background " +
              (e.tone === "accent"
                ? "bg-accent"
                : e.tone === "success"
                  ? "bg-emerald-500"
                  : e.tone === "warn"
                    ? "bg-amber-500"
                    : "bg-muted-foreground/60")
            }
          />
          <div className="flex flex-wrap items-baseline gap-2">
            <e.icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-serif text-lg leading-none tracking-tight">{e.label}</span>
            {e.ts ? (
              <span className="font-mono text-xs text-muted-foreground">
                {formatTimestamp(e.ts)}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{e.detail}</p>
        </li>
      ))}
    </ol>
  );
}
