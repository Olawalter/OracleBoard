"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Download, Eye, EyeOff, KeyRound, RefreshCcw, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn, shortAddress } from "@/lib/utils";
import { getAccount, resetAccount } from "@/lib/genlayer/client";
import { CLIENT_CHAIN } from "@/lib/genlayer/config";

const STORAGE_KEY = "oracleboard.account.pk";

function getStoredPk(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}

export function WalletIdentityBar() {
  const [address, setAddress] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pkVisible, setPkVisible] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedPk, setCopiedPk] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  function loadAddress() {
    try {
      const acc = getAccount();
      setAddress((acc as unknown as { address?: string }).address ?? null);
    } catch {
      setAddress(null);
    }
  }

  useEffect(() => {
    loadAddress();
  }, []);

  function handleCopyAddress() {
    if (!address) return;
    copyToClipboard(address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  }

  function handleCopyPk() {
    const pk = getStoredPk();
    if (!pk) return;
    copyToClipboard(pk);
    setCopiedPk(true);
    setTimeout(() => setCopiedPk(false), 2000);
  }

  function handleImport() {
    setImportError("");
    const trimmed = importValue.trim();
    if (!trimmed.startsWith("0x") || trimmed.length !== 66) {
      setImportError("Private key must be 0x followed by 64 hex characters.");
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      resetAccount();
      loadAddress();
      setImportValue("");
      setOpen(false);
    } catch (err) {
      setImportError("Failed to import key: " + (err as Error).message);
    }
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    resetAccount();
    setConfirmReset(false);
    setPkVisible(false);
    loadAddress();
    setOpen(false);
  }

  const pk = open ? getStoredPk() : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPkVisible(false); setConfirmReset(false); setImportValue(""); setImportError(""); } }}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "hidden items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs transition-colors hover:border-accent/50 hover:bg-card sm:flex",
          )}
        >
          <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-emerald-400" />
          <span className="uppercase tracking-[0.18em] text-muted-foreground">{CLIENT_CHAIN}</span>
          <span className="font-mono text-foreground">{shortAddress(address, 5, 4) || "—"}</span>
          <Wallet className="ml-0.5 h-3 w-3 text-muted-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            Your session wallet
          </DialogTitle>
          <DialogDescription>
            OracleBoard generates a local key stored in this browser. Export it to
            restore your identity in another session or browser.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Address */}
          <div className="grid gap-1.5">
            <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Address
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-xs">
                {address ?? "—"}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopyAddress}
                disabled={!address}
              >
                {copiedAddr ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Private key export */}
          <div className="grid gap-1.5">
            <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Private key (export)
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                {pk
                  ? pkVisible
                    ? pk
                    : "•".repeat(Math.min(pk.length, 32))
                  : "key not found in storage"}
              </code>
              {pk ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setPkVisible((v) => !v)}
                  >
                    {pkVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleCopyPk}
                  >
                    {copiedPk ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Download className="h-3.5 w-3.5" />}
                  </Button>
                </>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Save this key to restore your wallet in any browser or session. Anyone
              with this key controls your submissions.
            </p>
          </div>

          <Separator />

          {/* Import key */}
          <div className="grid gap-1.5">
            <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Import existing key
            </Label>
            <div className="flex items-center gap-2">
              <Input
                className="font-mono text-xs"
                placeholder="0x…"
                value={importValue}
                onChange={(e) => { setImportValue(e.target.value); setImportError(""); }}
                type="password"
                autoComplete="off"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleImport}
                disabled={!importValue.trim()}
                title="Apply imported key"
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </div>
            {importError ? (
              <p className="text-[11px] text-rose-400">{importError}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 text-xs",
              confirmReset && "border-rose-500/50 text-rose-400 hover:border-rose-500 hover:text-rose-300",
            )}
            onClick={handleReset}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {confirmReset ? "Click again to confirm — old key lost" : "Generate new wallet"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
