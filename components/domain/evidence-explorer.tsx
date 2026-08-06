"use client";
import { ExternalLink, FileText, Link as LinkIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function EvidenceExplorer({
  evidence,
  urls,
}: {
  evidence: string;
  urls: string[];
}) {
  const [q, setQ] = useState("");
  const lines = useMemo(() => evidence.split(/\r?\n/), [evidence]);
  const filtered = q
    ? lines.filter((line) => line.toLowerCase().includes(q.toLowerCase()))
    : lines;

  return (
    <Tabs defaultValue="evidence" className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="evidence">
            <FileText className="h-3.5 w-3.5" /> Evidence
          </TabsTrigger>
          <TabsTrigger value="sources">
            <LinkIcon className="h-3.5 w-3.5" /> Public sources
            <Badge variant="secondary" className="ml-1.5 rounded-full">
              {urls.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search evidence…"
          className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <TabsContent value="evidence">
        <div className="rounded-xl border border-border bg-background">
          <ScrollArea className="h-[520px]">
            <pre className="whitespace-pre-wrap px-6 py-5 font-mono text-[12.5px] leading-relaxed text-foreground/90">
              {filtered.length ? filtered.join("\n") : "No matches."}
            </pre>
          </ScrollArea>
        </div>
      </TabsContent>
      <TabsContent value="sources">
        {urls.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/50 p-8 text-center text-sm text-muted-foreground">
            No public URLs cited in this submission.
          </div>
        ) : (
          <ul className="grid gap-2">
            {urls.map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="truncate font-mono text-sm">{u}</div>
                </div>
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
        )}
      </TabsContent>
    </Tabs>
  );
}
