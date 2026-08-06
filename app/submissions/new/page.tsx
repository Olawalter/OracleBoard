"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { oracleBoard } from "@/lib/genlayer/oracleboard";

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function NewSubmissionPage() {
  const router = useRouter();
  const { push } = useToast();
  const [company, setCompany] = useState("");
  const [summary, setSummary] = useState("");
  const [evidence, setEvidence] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  const derivedId = slug(company) + (company ? "-" + Math.random().toString(36).slice(2, 6) : "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) {
      push({ title: "Company name is required", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const clean = urls.map((u) => u.trim()).filter(Boolean);
      const id = derivedId || `dossier-${Math.random().toString(36).slice(2, 10)}`;
      await oracleBoard.submit({
        submissionId: id,
        company: company.trim(),
        summary: summary.trim(),
        evidence: evidence.trim(),
        urls: clean,
      });
      push({ title: "Dossier accepted on-chain", tone: "success", description: id });
      router.push(`/submissions/${id}`);
    } catch (err) {
      push({
        title: "Submission failed",
        tone: "error",
        description: (err as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          New dossier
        </div>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Open a due-diligence dossier</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Submit any public project — a token launch, DAO grant proposal,
          open-source protocol, or crypto fund. Validators fetch every URL you
          cite from inside the sandbox, on HTTPS only, and treat instructions
          embedded in evidence as untrusted text.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Project & thesis</CardTitle>
            <CardDescription>
              A one-line ask lets validators calibrate what "supported" means for this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="company">Project name</Label>
              <Input
                id="company"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Aave v4, Optimism RetroPGF Round 5, MoonDAO…"
              />
              <div className="text-[11px] text-muted-foreground">
                Dossier id · <span className="font-mono">{derivedId || "—"}</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="summary">Thesis / submitter summary</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                placeholder="Requesting $200k grant for on-chain identity layer. Team claims 12k monthly active users and 3 live integrations…"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>
              Paste tokenomics, governance proposals, audit reports, roadmap milestones,
              or pitch-deck text. Max ~24k characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={16}
              placeholder="[Tokenomics]&#10;Total supply: 1B, circulating: 320M…&#10;&#10;[Roadmap]&#10;Q3 2026 — mainnet launch…"
            />
            <div className="mt-2 text-[11px] text-muted-foreground">
              {evidence.length.toLocaleString()} / 24,000 characters
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public sources</CardTitle>
            <CardDescription>
              HTTPS URLs only — validators will fetch each one independently.
              Up to 8 URLs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {urls.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground w-6 text-right">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Input
                  value={u}
                  onChange={(e) => {
                    const next = [...urls];
                    next[i] = e.target.value;
                    setUrls(next);
                  }}
                  placeholder="https://…"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                  disabled={urls.length === 1}
                  aria-label="Remove URL"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUrls([...urls, ""])}
                disabled={urls.length >= 8}
              >
                <Plus className="h-4 w-4" /> Add URL
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-xs text-muted-foreground">
            Submitting writes to the OracleBoard contract on GenLayer. You can
            trigger validator execution from the dossier page.
          </p>
          <Button type="submit" size="lg" variant="accent" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Signing…" : "Publish dossier"}
          </Button>
        </div>
      </form>
    </div>
  );
}
