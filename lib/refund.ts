// Pure helpers that turn the contract's bond fields into honest UI state.
// "refund_due" is an entitlement, NOT a payment; only refund_claimed > 0 means
// claim_refund ran and a payout transfer was emitted by the contract.

export type BondRecord = {
  bond_wei: number;
  refund_due: number;
  refund_claimed: number;
  forfeited: number;
};

export type BondPhase = "held" | "claimable" | "claimed" | "forfeited" | "settled";

export function formatGen(wei: number | bigint): string {
  const w = BigInt(wei);
  const whole = w / 10n ** 18n;
  const frac = (w % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** `resolved` is Challenge.resolved or Appeal.adjudicated. */
export function bondPhase(rec: BondRecord, resolved: boolean): BondPhase {
  if (!resolved) return "held";
  if (rec.refund_due > 0) return "claimable";
  if (rec.refund_claimed > 0) return "claimed";
  if (rec.forfeited > 0) return "forfeited";
  return "settled";
}

export function bondLabel(rec: BondRecord, resolved: boolean): string {
  switch (bondPhase(rec, resolved)) {
    case "held":
      return `${formatGen(rec.bond_wei)} GEN bond held — dispute unresolved`;
    case "claimable":
      return `Refund available to claim: ${formatGen(rec.refund_due)} GEN (not yet paid)`;
    case "claimed":
      return `Refund claimed: ${formatGen(rec.refund_claimed)} GEN — payout transfer emitted by the contract`;
    case "forfeited":
      return `Bond forfeited: ${formatGen(rec.forfeited)} GEN — verdict upheld`;
    default:
      return "Bond settled";
  }
}

export function canClaim(
  rec: BondRecord,
  resolved: boolean,
  depositor: string,
  me: string | null | undefined,
): boolean {
  return (
    !!me &&
    bondPhase(rec, resolved) === "claimable" &&
    depositor.toLowerCase() === me.toLowerCase()
  );
}
