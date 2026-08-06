import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        404 · off the record
      </div>
      <h1 className="font-serif text-4xl tracking-tight">This dossier does not exist.</h1>
      <p className="text-muted-foreground">
        The page you asked for was not filed with the OracleBoard contract.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Return home</Link>
      </Button>
    </div>
  );
}
