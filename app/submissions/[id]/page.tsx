"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Cpu, Flag, Gavel, Loader2, RefreshCcw, Scale, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceExplorer } from "@/components/domain/evidence-explorer";
import { VerdictCard } from "@/components/domain/verdict-card";
import { ConsensusTimeline } from "@/components/domain/consensus-timeline";
import { useSubmissionBundle } from "@/lib/hooks/use-submissions";
import { APPEAL_BOND_WEI, oracleBoard } from "@/lib/genlayer/oracleboard";
import { useToast } from "@/components/ui/toast";
import { formatTimestamp, shortAddress } from "@/lib/utils";

export default function SubmissionPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const { submission, verdict, challenge, appeal, refresh, loading, error } = useSubmissionBundle(id);
  const { push } = useToast();
  const [evaluating, setEvaluating] = useState(false);
  const [challengeKind, setChallengeKind] = useState<"new_evidence" | "factual_error">("new_evidence");
  const [challengeEvidence, setChallengeEvidence] = useState("");
  const [challengeReason, setChallengeReason] = useState("");
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [appealRebuttal, setAppealRebuttal] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [adjudicating, setAdjudicating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy = evaluating || adjudicating;
  useEffect(() => {
    if (busy) {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setElapsed(0);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [busy]);

  function fmtElapsed(s: number) {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  async function runEvaluate() {
    if (!id) return;
    setEvaluating(true);
    const MAX_ATTEMPTS = 3;
    let lastErr: Error | null = null;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          if (challenge && !challenge.resolved) {
            await oracleBoard.reevaluate(id);
          } else {
            await oracleBoard.evaluate(id);
          }
          push({
            title: attempt > 1
              ? `Consensus reached (attempt ${attempt})`
              : "Consensus verdict finalized",
            tone: "success",
          });
          await refresh();
          return;
        } catch (err) {
          lastErr = err as Error;
          const msg = lastErr.message ?? "";
          // UNDETERMINED means validators disagreed — worth retrying
          const isUndetermined =
            msg.toLowerCase().includes("undetermined") ||
            msg.toLowerCase().includes("consensus");
          if (!isUndetermined || attempt === MAX_ATTEMPTS) throw lastErr;
          push({
            title: `Validators disagreed — retrying (${attempt}/${MAX_ATTEMPTS})`,
            tone: "default",
          });
        }
      }
    } catch (err) {
      push({
        title: "Validator run failed",
        tone: "error",
        description: (err as Error).message,
      });
    } finally {
      setEvaluating(false);
    }
  }

  async function submitAppeal() {
    if (!id) return;
    setAppealBusy(true);
    const MAX_ATTEMPTS = 2;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await oracleBoard.appeal({ submissionId: id, rebuttal: appealRebuttal });
          push({ title: "Appeal filed — bond posted", tone: "success" });
          setAppealOpen(false);
          setAppealRebuttal("");
          await refresh();
          return;
        } catch (err) {
          const msg = (err as Error).message ?? "";
          const isUndetermined =
            msg.toLowerCase().includes("undetermined") ||
            msg.toLowerCase().includes("consensus");
          if (!isUndetermined || attempt === MAX_ATTEMPTS) throw err;
          push({ title: `Validators disagreed — retrying appeal (${attempt}/${MAX_ATTEMPTS})`, tone: "default" });
        }
      }
    } catch (err) {
      push({
        title: "Appeal failed",
        tone: "error",
        description: (err as Error).message,
      });
    } finally {
      setAppealBusy(false);
    }
  }

  async function runAdjudicate() {
    if (!id) return;
    setAdjudicating(true);
    const MAX_ATTEMPTS = 3;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await oracleBoard.adjudicate(id);
          push({
            title: attempt > 1
              ? `Appeal adjudicated (attempt ${attempt})`
              : "Appeal adjudicated — verdict updated",
            tone: "success",
          });
          await refresh();
          return;
        } catch (err) {
          const msg = (err as Error).message ?? "";
          const isUndetermined =
            msg.toLowerCase().includes("undetermined") ||
            msg.toLowerCase().includes("consensus");
          if (!isUndetermined || attempt === MAX_ATTEMPTS) throw err;
          push({ title: `Validators disagreed — retrying (${attempt}/${MAX_ATTEMPTS})`, tone: "default" });
        }
      }
    } catch (err) {
      push({
        title: "Adjudication failed",
        tone: "error",
        description: (err as Error).message,
      });
    } finally {
      setAdjudicating(false);
    }
  }

  async function submitChallenge() {
    if (!id) return;
    setChallengeBusy(true);
    try {
      await oracleBoard.challenge({
        submissionId: id,
        kind: challengeKind,
        evidence: challengeEvidence,
        reason: challengeReason,
      });
      push({ title: "Challenge opened", tone: "success" });
      setChallengeOpen(false);
      setChallengeEvidence("");
      setChallengeReason("");
      await refresh();
    } catch (err) {
      push({
        title: "Challenge rejected",
        tone: "error",
        description: (err as Error).message,
      });
    } finally {
      setChallengeBusy(false);
    }
  }

  if (loading && !submission) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading dossier…
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
        <ShieldQuestion className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 font-serif text-2xl">Dossier not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? "This id has never been submitted."}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/submissions">Back to consensus board</Link>
        </Button>
      </div>
    );
  }

  // Derive appealed state from submission.status when the appeal object is
  // unavailable (StudioNet TreeMap reads can fail after a successful write).
  const isAppealed =
    (appeal && !appeal.adjudicated) ||
    submission.status === "appealed";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/submissions"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Consensus board
          </Link>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-serif text-4xl tracking-tight">{submission.company}</h1>
            <Badge
              variant={
                isAppealed ? "warning"
                : verdict ? "success"
                : challenge && !challenge.resolved ? "warning"
                : "outline"
              }
              className="capitalize"
            >
              {isAppealed ? "appealed"
                : verdict ? "resolved"
                : challenge && !challenge.resolved ? "challenged"
                : "pending"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
            <span>id · {submission.id}</span>
            <span>submitter · {shortAddress(submission.submitter, 8, 6)}</span>
            <span>opened · {formatTimestamp(submission.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          {isAppealed ? (
            <div className="flex flex-col items-end gap-1">
              <Button variant="accent" onClick={runAdjudicate} disabled={adjudicating}>
                {adjudicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
                {adjudicating ? `Adjudicating… ${fmtElapsed(elapsed)}` : "Adjudicate appeal"}
              </Button>
              {adjudicating && (
                <span className="text-[11px] text-muted-foreground">Validators typically take 3–12 min</span>
              )}
            </div>
          ) : challenge && !challenge.resolved ? (
            <div className="flex flex-col items-end gap-1">
              <Button variant="accent" onClick={runEvaluate} disabled={evaluating}>
                {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                {evaluating ? `Reevaluating… ${fmtElapsed(elapsed)}` : "Reevaluate under challenge"}
              </Button>
              {evaluating && (
                <span className="text-[11px] text-muted-foreground">Validators typically take 3–12 min</span>
              )}
            </div>
          ) : !verdict ? (
            <div className="flex flex-col items-end gap-1">
              <Button variant="accent" onClick={runEvaluate} disabled={evaluating}>
                {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                {evaluating ? `Running validators… ${fmtElapsed(elapsed)}` : "Run validators"}
              </Button>
              {evaluating && (
                <span className="text-[11px] text-muted-foreground">Validators typically take 3–12 min</span>
              )}
            </div>
          ) : null}
          {verdict && !appeal && !isAppealed ? (
            <Dialog open={appealOpen} onOpenChange={setAppealOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Scale className="h-4 w-4" /> Appeal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Appeal this verdict</DialogTitle>
                  <DialogDescription>
                    Post a bond of 0.001 GEN and submit a rebuttal explaining why
                    the initial evaluation was incorrect. A secondary validator
                    panel will re-evaluate all evidence plus your rebuttal. If the
                    verdict changes, your bond is refunded.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Rebuttal instructions (min 64 characters)</Label>
                    <Textarea
                      value={appealRebuttal}
                      onChange={(e) => setAppealRebuttal(e.target.value)}
                      rows={8}
                      placeholder="Explain specifically why the verdict is incorrect. Reference concrete evidence the validators may have missed or misinterpreted. Example: 'The verdict flags the fee switch as a risk, but governance proposal #42 (passed March 2025) activated it on Polygon with a 6-month revenue track record…'"
                    />
                    <div className="text-[11px] text-muted-foreground">
                      {appealRebuttal.length} / 4,000 characters
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                    <strong>Bond:</strong> 0.001 GEN (refunded if verdict changes)
                    <br />
                    <strong>Note:</strong> Only the original submitter can file an appeal.
                    On StudioNet, the bond is symbolic — transactions are gasless.
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAppealOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    onClick={submitAppeal}
                    disabled={appealBusy || appealRebuttal.length < 64}
                  >
                    {appealBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Post bond & appeal
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
          {verdict ? (
            <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Flag className="h-4 w-4" /> Challenge
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Challenge this verdict</DialogTitle>
                  <DialogDescription>
                    Challenges must contribute new material evidence or identify a
                    factual error the validators missed.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="flex gap-2">
                    {(["new_evidence", "factual_error"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setChallengeKind(k)}
                        className={
                          "flex-1 rounded-md border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition-colors " +
                          (challengeKind === k
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted-foreground hover:text-foreground")
                        }
                      >
                        {k.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <Label>New evidence (required for new_evidence)</Label>
                    <Textarea
                      value={challengeEvidence}
                      onChange={(e) => setChallengeEvidence(e.target.value)}
                      rows={6}
                      placeholder="Paste the new evidence — at least 32 characters."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Reason (required for factual_error)</Label>
                    <Textarea
                      value={challengeReason}
                      onChange={(e) => setChallengeReason(e.target.value)}
                      rows={4}
                      placeholder="Explain the factual error you believe the validators made."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setChallengeOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    onClick={submitChallenge}
                    disabled={challengeBusy}
                  >
                    {challengeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Open challenge
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          {verdict ? (
            <VerdictCard verdict={verdict} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No consensus verdict yet</CardTitle>
                <CardDescription>
                  Trigger validator execution above. Validators will fetch every
                  cited URL, grade the eight dimensions, and only agree if their
                  bucketed signatures match.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Executing a dossier costs GEN. On StudioNet, transactions are
                gasless — feel free to iterate.
              </CardContent>
            </Card>
          )}

          {submission.summary ? (
            <Card>
              <CardHeader>
                <CardTitle>Submitter thesis</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
                {submission.summary}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Evidence workspace</CardTitle>
              <CardDescription>
                Explore the submitted evidence and the URLs validators will
                independently fetch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EvidenceExplorer evidence={submission.evidence_digest} urls={submission.urls} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Consensus timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsensusTimeline
                submission={submission}
                verdict={verdict}
                challenge={challenge}
              />
            </CardContent>
          </Card>

          {challenge ? (
            <Card>
              <CardHeader>
                <CardTitle>Active challenge</CardTitle>
                <CardDescription>
                  {challenge.kind === "new_evidence" ? "New evidence" : "Factual error"} raised by{" "}
                  <span className="font-mono">{shortAddress(challenge.challenger, 6, 4)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                {challenge.reason ? (
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Reason
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{challenge.reason}</p>
                  </div>
                ) : null}
                {challenge.evidence_digest ? (
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Evidence
                    </div>
                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-muted-foreground">
                      {challenge.evidence_digest}
                    </pre>
                  </div>
                ) : null}
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Opened {formatTimestamp(challenge.created_at)}</span>
                  <Badge variant={challenge.resolved ? "success" : "warning"}>
                    {challenge.resolved ? "resolved" : "open"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {isAppealed && !appeal ? (
            <Card>
              <CardHeader>
                <CardTitle>Appeal</CardTitle>
                <CardDescription>Filed — awaiting on-chain read</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>The appeal was written on-chain but the details are not yet
                readable from this node (a known StudioNet TreeMap read lag).
                Click <strong>Refresh</strong> in a few seconds — or proceed
                directly to <strong>Adjudicate appeal</strong> above.</p>
              </CardContent>
            </Card>
          ) : null}

          {appeal ? (
            <Card>
              <CardHeader>
                <CardTitle>Appeal</CardTitle>
                <CardDescription>
                  Filed by{" "}
                  <span className="font-mono">{shortAddress(appeal.appellant, 6, 4)}</span>
                  {" · Bond: "}
                  {(appeal.bond_wei / 1e15).toFixed(3)} GEN
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Rebuttal
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{appeal.rebuttal}</p>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Filed {formatTimestamp(appeal.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {appeal.adjudicated ? (
                      <>
                        <Badge variant={appeal.overturned ? "success" : "outline"}>
                          {appeal.overturned ? "overturned" : "upheld"}
                        </Badge>
                        {appeal.refunded ? (
                          <Badge variant="success">bond refunded</Badge>
                        ) : null}
                      </>
                    ) : (
                      <Badge variant="warning">pending adjudication</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : isAppealed ? (
            // StudioNet TreeMap reads can fail after a write — show a
            // placeholder so the panel isn't silently blank.
            <Card>
              <CardHeader>
                <CardTitle>Appeal</CardTitle>
                <CardDescription>Filed — details loading from chain</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Bond: 0.001 GEN (symbolic on StudioNet)</span>
                  <Badge variant="warning">pending adjudication</Badge>
                </div>
                <p className="mt-3 text-xs">
                  The appeal was accepted on-chain. Click{" "}
                  <strong>Adjudicate appeal</strong> above to run the secondary
                  validator panel.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Public report</CardTitle>
              <CardDescription>
                Share this dossier's verdict with a read-only URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full justify-between">
                <Link href={`/report/${submission.id}`}>
                  Open public report <ArrowLeft className="h-4 w-4 rotate-180" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
