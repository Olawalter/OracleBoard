"use client";
import { ensureClientReady, getClient } from "./client";
import { requireContractAddress } from "./config";

export type SubmissionRow = {
  id: string;
  company: string;
  submitter: string;
  created_at: number;
  status: "pending" | "resolved" | "challenged" | string;
};

export type Submission = SubmissionRow & {
  summary: string;
  evidence_digest: string;
  urls: string[];
};

export type Verdict = {
  submission_id: string;
  overall_risk: "low" | "moderate" | "elevated" | "high" | "severe";
  confidence: "low" | "medium" | "high";
  evidence_coverage: number;
  supported_claims: number;
  unsupported_claims: number;
  contradictions: number;
  material_risks: string[];
  follow_up: string[];
  summary: string;
  finalized_at: number;
};

export type Challenge = {
  submission_id: string;
  index: number;
  challenger: string;
  kind: "new_evidence" | "factual_error";
  evidence_digest: string;
  reason: string;
  bond_wei: number;
  created_at: number;
  resolved: boolean;
  /** Claimable now (resolved in the depositor's favour, not yet claimed). */
  refund_due: number;
  /** Amount for which a payout transfer has been emitted by claim_refund. */
  refund_claimed: number;
  /** Amount kept by the contract (verdict upheld). */
  forfeited: number;
};

export type Appeal = {
  submission_id: string;
  index: number;
  appellant: string;
  bond_wei: number;
  rebuttal: string;
  created_at: number;
  adjudicated: boolean;
  overturned: boolean;
  refund_due: number;
  refund_claimed: number;
  forfeited: number;
};

export type DisputeState = {
  active: "challenge" | "appeal" | "";
  challenge_count: number;
  appeal_count: number;
};

export type Accounting = {
  deposited_total: number;
  pending_bonds: number;
  refund_liability: number;
  refunded_total: number;
  forfeited_total: number;
  balance: number;
};

export const APPEAL_BOND_WEI = BigInt("1000000000000000");    // 0.001 GEN
export const CHALLENGE_BOND_WEI = BigInt("1000000000000000"); // 0.001 GEN — forfeited if reevaluation upholds

type ContractArg =
  | string
  | number
  | bigint
  | boolean
  | null
  | ContractArg[]
  | { [k: string]: ContractArg };

async function view<T>(method: string, args: ContractArg[] = []): Promise<T> {
  await ensureClientReady();
  const client = getClient();
  return (await client.readContract({
    address: requireContractAddress(),
    functionName: method,
    args: args as never,
  })) as T;
}

const TERMINAL_STATUSES: Record<string, boolean> = {
  ACCEPTED: true,
  FINALIZED: true,
  UNDETERMINED: true,
  CANCELED: true,
  LEADER_TIMEOUT: true,
  VALIDATORS_TIMEOUT: true,
};
const NUMERIC_TO_NAME: Record<number, string> = {
  5: "ACCEPTED",
  6: "UNDETERMINED",
  7: "FINALIZED",
  8: "CANCELED",
  12: "VALIDATORS_TIMEOUT",
  13: "LEADER_TIMEOUT",
};

async function pollUntilDecided(
  client: ReturnType<typeof getClient>,
  hash: string,
  retries = 80,
  interval = 3000,
) {
  for (let i = 0; i < retries; i++) {
    const tx = await client.getTransaction({ hash: hash as never });
    const name = tx.statusName;
    const num = tx.status;
    const status =
      (typeof name === "string" && name) ||
      (typeof num === "number" ? NUMERIC_TO_NAME[num] : undefined) ||
      String(num ?? "");
    if (TERMINAL_STATUSES[status]) {
      return { tx, status };
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Transaction polling timed out after " + retries + " retries");
}

async function write(method: string, args: ContractArg[] = [], value = BigInt(0)) {
  await ensureClientReady();
  const client = getClient();
  const hash = await client.writeContract({
    address: requireContractAddress(),
    functionName: method,
    args: args as never,
    value,
    leaderOnly: false,
  });
  const { tx, status } = await pollUntilDecided(client, hash as string);
  if (status === "UNDETERMINED") {
    throw new Error(
      "Validators could not reach consensus (UNDETERMINED). This can happen when validators disagree on the verdict. Try again — StudioNet consensus is non-deterministic.",
    );
  }
  if (status === "CANCELED" || status === "LEADER_TIMEOUT" || status === "VALIDATORS_TIMEOUT") {
    throw new Error(`Transaction ${status.replace("_", " ").toLowerCase()}. Try again.`);
  }
  return { hash, receipt: tx };
}

/**
 * challenge / appeal never raise once value is attached (a raising transaction
 * keeps the attached GEN on StudioNet). A refused call therefore still looks
 * like a successful transaction, so acceptance is confirmed from contract
 * state: the dispute counter must have increased. On refusal the contract
 * emits a refund of the full attached value on finalization.
 */
async function acceptedDispute(
  submissionId: string,
  counter: "challenge_count" | "appeal_count",
  send: () => Promise<{ hash: unknown; receipt: unknown }>,
) {
  const before = (await view<DisputeState>("get_dispute_state", [submissionId]).catch(() => null))?.[counter] ?? 0;
  const result = await send();
  const after = (await view<DisputeState>("get_dispute_state", [submissionId]).catch(() => null))?.[counter];
  if (after === undefined || Number(after) <= Number(before)) {
    throw new Error(
      "The contract refused this request (for example another dispute is still open, or the bond or input was invalid). " +
        "Nothing was recorded; the attached bond is returned to your account when the transaction finalizes.",
    );
  }
  return result;
}

export const oracleBoard = {
  listSubmissions: (offset = 0, limit = 50) =>
    view<SubmissionRow[]>("list_submissions", [offset, limit]),
  getSubmission: (id: string) => view<Submission>("get_submission", [id]),
  getVerdict: (id: string) => view<Verdict>("get_verdict", [id]),
  getChallenge: (id: string) => view<Challenge>("get_challenge", [id]),
  getAppeal: (id: string) => view<Appeal>("get_appeal", [id]),
  getDisputeState: (id: string) => view<DisputeState>("get_dispute_state", [id]),
  getAccounting: () => view<Accounting>("get_accounting"),

  submit: (input: {
    submissionId: string;
    company: string;
    summary: string;
    evidence: string;
    urls: string[];
  }) =>
    write("submit", [
      input.submissionId,
      input.company,
      input.summary,
      input.evidence,
      input.urls,
    ]),

  evaluate: (submissionId: string) => write("evaluate", [submissionId]),

  challenge: (input: {
    submissionId: string;
    kind: "new_evidence" | "factual_error";
    evidence: string;
    reason: string;
    bondWei?: bigint;
  }) =>
    acceptedDispute(
      input.submissionId,
      "challenge_count",
      () => write("challenge", [input.submissionId, input.kind, input.evidence, input.reason], input.bondWei ?? CHALLENGE_BOND_WEI),
    ),

  reevaluate: (submissionId: string) => write("reevaluate", [submissionId]),

  appeal: (input: { submissionId: string; rebuttal: string; bondWei?: bigint }) =>
    acceptedDispute(
      input.submissionId,
      "appeal_count",
      () => write("appeal", [input.submissionId, input.rebuttal], input.bondWei ?? APPEAL_BOND_WEI),
    ),

  adjudicate: (submissionId: string) => write("adjudicate", [submissionId]),

  /** Depositor withdraws a refund entitlement; the contract emits the transfer. */
  claimRefund: (input: { kind: "challenge" | "appeal"; submissionId: string; index?: number }) =>
    write("claim_refund", [input.kind, input.submissionId, input.index ?? 0]),
};

export async function safeGetVerdict(id: string) {
  try {
    return await oracleBoard.getVerdict(id);
  } catch {
    return null;
  }
}

export async function safeGetChallenge(id: string) {
  try {
    return await oracleBoard.getChallenge(id);
  } catch {
    return null;
  }
}

export async function safeGetDisputeState(id: string) {
  try {
    return await oracleBoard.getDisputeState(id);
  } catch {
    return null;
  }
}

export async function safeGetAppeal(id: string) {
  try {
    return await oracleBoard.getAppeal(id);
  } catch {
    return null;
  }
}
