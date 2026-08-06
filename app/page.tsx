import Link from "next/link";
import { ArrowRight, Building2, ClipboardCheck, GitCompare, Scale, ScanText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PILLARS = [
  {
    icon: ScanText,
    title: "Independent inspection",
    body: "Every validator opens the dossier, fetches the URLs cited in the submission, and forms its own reading. No leader-only shortcuts.",
  },
  {
    icon: GitCompare,
    title: "Substantive equivalence",
    body: "We compare the bucketed risk signature — not the prose — so validators can disagree on wording while agreeing on the verdict.",
  },
  {
    icon: ShieldCheck,
    title: "Prompt-injection hardened",
    body: "URLs are HTTPS-only, private hosts are blocked, submissions are quoted as evidence, and instructions embedded in evidence are ignored.",
  },
  {
    icon: Scale,
    title: "Challenge with new evidence",
    body: "Verdicts stand until a challenger produces new material evidence or a factual error. Then the validators re-open the file.",
  },
];

const DIMENSIONS = [
  "Business model coherence",
  "Financial consistency",
  "Roadmap realism",
  "Technical credibility",
  "Legal risk",
  "Operational risk",
  "Evidence support",
  "Internal contradictions",
];

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-24">
      <section className="relative flex flex-col gap-10 pt-10">
        <div className="flex flex-col gap-6 md:max-w-3xl">
          <Badge variant="outline" className="w-fit gap-2 border-accent/40 bg-accent/5 text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Consensus due diligence · GenLayer StudioNet
          </Badge>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-balance md:text-6xl">
            One model's opinion is not a verdict.<br />
            <span className="text-muted-foreground">A room full of validators is.</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground text-balance">
            OracleBoard AI turns public-project due diligence into an on-chain
            judgment. Independent AI validators fetch public sources, weigh the
            evidence and reach consensus on the questions no single model should
            decide alone.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/submissions/new">
                Open a dossier <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/submissions">Browse consensus</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {[
            { label: "Validators per verdict", value: "5+" },
            { label: "Assessment dimensions", value: "8" },
            { label: "Evidence sources fetched", value: "on-chain" },
            { label: "Challenge window", value: "always open" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card px-6 py-6">
              <div className="font-serif text-3xl tracking-tight">{stat.value}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p) => (
          <Card key={p.title} className="animate-fade-in bg-card/70">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                <p.icon className="h-5 w-5 text-accent" />
              </div>
              <CardTitle className="mt-3 text-lg">{p.title}</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed">{p.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-10 rounded-2xl border border-border bg-card/60 p-8 md:grid-cols-[1.1fr_1fr] md:p-12">
        <div className="flex flex-col gap-6">
          <Badge variant="outline" className="w-fit uppercase tracking-[0.16em] text-xs">
            The eight dimensions
          </Badge>
          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            The questions no single model should answer alone.
          </h2>
          <p className="max-w-lg text-muted-foreground">
            Validators grade every dossier against the same rubric, then agree on
            the verdict signature — overall risk band, confidence, evidence
            coverage, supported and unsupported claims, contradictions and material
            risks.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DIMENSIONS.map((d) => (
            <div
              key={d}
              className="rounded-lg border border-border bg-background/60 px-4 py-3 text-sm"
            >
              {d}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
              How a verdict is reached
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Four steps, on-chain, from submission to public report.
            </p>
          </div>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {[
            { icon: Building2, title: "01 · Submit", body: "Open a dossier on any public project — cite URLs, paste evidence, describe the ask." },
            { icon: ScanText, title: "02 · Fetch", body: "Every validator opens the URLs itself, from inside the sandbox." },
            { icon: ClipboardCheck, title: "03 · Judge", body: "Validators grade the eight dimensions and emit a signed verdict." },
            { icon: Scale, title: "04 · Consense", body: "The bucketed signature is compared. Only the accepted verdict is stored." },
          ].map((step) => (
            <div key={step.title} className="flex flex-col gap-3 bg-card px-6 py-6">
              <step.icon className="h-4 w-4 text-accent" />
              <div className="font-serif text-lg tracking-tight">{step.title}</div>
              <div className="text-sm text-muted-foreground">{step.body}</div>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col items-start gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>Deployed with genlayer-js 1.1.8 · StudioNet chain 61999.</span>
          <Button asChild variant="link" className="p-0 text-sm">
            <Link href="/submissions">Open the consensus board →</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
