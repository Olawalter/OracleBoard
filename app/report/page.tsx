"use client";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubmissionList } from "@/lib/hooks/use-submissions";

export default function ReportsIndex() {
  const { rows } = useSubmissionList();
  const resolved = (rows ?? []).filter((r) => r.status === "resolved");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Public reports
        </div>
        <h1 className="mt-1 font-serif text-4xl tracking-tight">Published verdicts</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Every resolved dossier is published as a read-only report, backed by
          the OracleBoard Intelligent Contract.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {resolved.length === 0 ? (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>No resolved dossiers yet</CardTitle>
              <CardDescription>
                Once a dossier reaches consensus, its report shows up here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          resolved.map((r) => (
            <Link key={r.id} href={`/report/${r.id}`}>
              <Card className="group h-full transition-colors hover:border-accent/60">
                <CardHeader>
                  <FileText className="h-5 w-5 text-accent" />
                  <CardTitle className="mt-3">{r.company}</CardTitle>
                  <CardDescription className="font-mono text-[11px]">{r.id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="success">Resolved</Badge>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
