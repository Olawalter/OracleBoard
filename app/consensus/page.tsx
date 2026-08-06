"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Activity, Radar, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubmissionList } from "@/lib/hooks/use-submissions";
import { formatTimestamp } from "@/lib/utils";

export default function ConsensusFeedPage() {
  const { rows, loading, refresh } = useSubmissionList();

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      resolved: list.filter((r) => r.status === "resolved").length,
      challenged: list.filter((r) => r.status === "challenged").length,
      pending: list.filter((r) => r.status === "pending").length,
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Radar className="h-3.5 w-3.5" /> Consensus feed
          </div>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">The room, live.</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            The state of every dossier, streamed straight from the OracleBoard
            Intelligent Contract.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCcw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        <StatTile label="Total dossiers" value={stats.total} />
        <StatTile label="Resolved" value={stats.resolved} tone="success" />
        <StatTile label="Challenged" value={stats.challenged} tone="warn" />
        <StatTile label="Pending" value={stats.pending} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest activity</CardTitle>
          <CardDescription>
            Chronological stream of the most recent 20 submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3">
            {(rows ?? []).slice(0, 20).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-background px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/submissions/${r.id}`}
                    className="font-serif text-base hover:text-accent"
                  >
                    {r.company}
                  </Link>
                  <div className="font-mono text-[11px] text-muted-foreground">{r.id}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(r.created_at)}
                  </span>
                  <Badge
                    variant={
                      r.status === "resolved"
                        ? "success"
                        : r.status === "challenged"
                          ? "warning"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {r.status}
                  </Badge>
                </div>
              </li>
            ))}
            {(!rows || rows.length === 0) && !loading ? (
              <li className="rounded-md border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                No submissions yet. The room is quiet.
              </li>
            ) : null}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warn" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="bg-card p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <Activity className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-3 font-serif text-4xl tracking-tight ${toneClass}`}>{value}</div>
    </div>
  );
}
