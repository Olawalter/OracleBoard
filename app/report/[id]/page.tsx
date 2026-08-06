"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VerdictCard } from "@/components/domain/verdict-card";
import { ConsensusTimeline } from "@/components/domain/consensus-timeline";
import { Button } from "@/components/ui/button";
import { useSubmissionBundle } from "@/lib/hooks/use-submissions";
import { formatTimestamp, shortAddress } from "@/lib/utils";
import { CONTRACT_ADDRESS } from "@/lib/genlayer/config";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const { submission, verdict, challenge, loading } = useSubmissionBundle(id);

  if (loading && !submission) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report…
      </div>
    );
  }
  if (!submission) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="font-serif text-2xl">Report unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This dossier has not been submitted or is not yet resolved.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/report">All reports</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/report"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All reports
        </Link>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Public consensus report
        </div>
        <h1 className="font-serif text-5xl tracking-tight text-balance">{submission.company}</h1>
        <div className="flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
          <span>id · {submission.id}</span>
          <span>submitter · {shortAddress(submission.submitter, 8, 6)}</span>
          <span>opened · {formatTimestamp(submission.created_at)}</span>
          {CONTRACT_ADDRESS ? (
            <span>contract · {shortAddress(CONTRACT_ADDRESS, 6, 4)}</span>
          ) : null}
        </div>
      </div>

      {verdict ? (
        <VerdictCard verdict={verdict} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Awaiting consensus</CardTitle>
            <CardDescription>
              Validators have not yet reached a verdict for this dossier.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {submission.summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Submitter thesis</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {submission.summary}
          </CardContent>
        </Card>
      ) : null}

      {submission.urls.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Public sources considered</CardTitle>
            <CardDescription>
              Each URL was fetched independently by every validator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {submission.urls.map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-2">
                  <span className="truncate font-mono text-sm">{u}</span>
                  <a
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Consensus timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsensusTimeline submission={submission} verdict={verdict} challenge={challenge} />
        </CardContent>
      </Card>

      <Separator />
      <div className="text-xs text-muted-foreground">
        Verdict served by the OracleBoard Intelligent Contract on GenLayer.
        Source of truth is on-chain; this page is a rendering.
      </div>
    </div>
  );
}
