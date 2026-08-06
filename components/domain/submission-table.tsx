"use client";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SubmissionRow } from "@/lib/genlayer/oracleboard";
import { formatTimestamp, shortAddress } from "@/lib/utils";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "outline"> = {
  resolved: "success",
  challenged: "warning",
  appealed: "warning",
  pending: "outline",
};

export function SubmissionTable({
  rows,
  loading,
}: {
  rows: SubmissionRow[] | null;
  loading: boolean;
}) {
  if (loading && !rows) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-background/60 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading consensus board…
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/40 p-12 text-center">
        <div className="font-serif text-xl">No dossiers yet.</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Open the first submission to see how consensus is reached.
        </p>
        <Link
          href="/submissions/new"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          Submit a dossier <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-5 py-3 font-medium">Project</th>
            <th className="px-5 py-3 font-medium">Submitter</th>
            <th className="px-5 py-3 font-medium">Opened</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="w-10 px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-secondary/40">
              <td className="px-5 py-3">
                <div className="font-serif text-base leading-tight">{s.company}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{s.id}</div>
              </td>
              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                {shortAddress(s.submitter)}
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground">
                {formatTimestamp(s.created_at)}
              </td>
              <td className="px-5 py-3">
                <Badge variant={STATUS_TONE[s.status] ?? "outline"} className="capitalize">
                  {s.status}
                </Badge>
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={`/submissions/${s.id}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary"
                  aria-label={`Open ${s.company}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
