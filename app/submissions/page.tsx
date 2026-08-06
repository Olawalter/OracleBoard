"use client";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmissionTable } from "@/components/domain/submission-table";
import { useSubmissionList } from "@/lib/hooks/use-submissions";

export default function SubmissionsPage() {
  const { rows, loading, error, refresh } = useSubmissionList();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Consensus board
          </div>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">Live dossiers</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Every submission, every verdict, every open challenge — settled on-chain
            through independent AI validators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button asChild variant="accent">
            <Link href="/submissions/new">Submit dossier</Link>
          </Button>
        </div>
      </div>
      {error ? (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
      <SubmissionTable rows={rows} loading={loading} />
    </div>
  );
}
