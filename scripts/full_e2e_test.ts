/**
 * Full end-to-end test: submit → evaluate → appeal → adjudicate
 * Uses a single wallet for all operations so the submitter matches.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const CONTRACT = process.env.NEXT_PUBLIC_ORACLEBOARD_ADDRESS as `0x${string}`;
const BOND = BigInt("1000000000000000");
const MAX_ATTEMPTS = 5;
const SUBMISSION_ID = `e2e-test-${Date.now().toString(36)}`;

const STATUS_NAME: Record<number, string> = {
  5: "ACCEPTED", 6: "UNDETERMINED", 7: "FINALIZED", 8: "CANCELED",
  12: "VALIDATORS_TIMEOUT", 13: "LEADER_TIMEOUT",
};

async function writeWithRetry(
  client: ReturnType<typeof createClient>,
  params: { address: `0x${string}`; functionName: string; args: any[]; value: bigint },
  label: string,
) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`  [${label}] attempt ${attempt}/${MAX_ATTEMPTS}...`);
    try {
      const hash = await client.writeContract({ ...params, leaderOnly: false });
      console.log(`  tx: ${hash}`);
      for (let i = 0; i < 120; i++) {
        const tx = await client.getTransaction({ hash: hash as `0x${string}` });
        const status = STATUS_NAME[tx.status as number] || String(tx.status);
        if (status === "ACCEPTED" || status === "FINALIZED") {
          console.log(`  ${status}`);
          return;
        }
        if (["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(status)) {
          console.log(`  ${status} — retrying`);
          break;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
      if (err.message.includes("already")) throw err;
    }
  }
  throw new Error(`${label}: all attempts exhausted`);
}

async function main() {
  const acc = createAccount();
  const client = createClient({ chain: studionet, account: acc });
  const addr = (acc as any).address || "unknown";

  console.log(`\n=== OracleBoard E2E Test ===`);
  console.log(`Wallet:     ${addr}`);
  console.log(`Contract:   ${CONTRACT}`);
  console.log(`Submission: ${SUBMISSION_ID}\n`);

  // ── Step 1: Submit ──
  console.log("1. SUBMIT");
  await writeWithRetry(client, {
    address: CONTRACT,
    functionName: "submit",
    args: [
      SUBMISSION_ID,
      "MakerDAO (Sky)",
      "MakerDAO rebranded to Sky Protocol. Claims $8B TVL, DAI stablecoin backing, and governance via MKR token.",
      "MakerDAO/Sky Evidence:\n\n[Protocol] Rebranded from MakerDAO to Sky Protocol in 2024. DAI stablecoin (now USDS) backed by crypto collateral and RWA. TVL ~$8B. Revenue from stability fees.\n\n[Tokenomics] MKR token governance - 1M supply. USDS stablecoin at 1:1 USD peg. SubDAO token SKY distributed.\n\n[Security] Multiple audits. Bug bounty via Immunefi. Has survived multiple market crashes including March 2020.\n\n[Risks] Heavy RWA exposure. Rebrand confusion. Regulatory uncertainty around stablecoins.",
      ["https://makerdao.com"],
    ],
    value: BigInt(0),
  }, "submit");

  const sub = await client.readContract({
    address: CONTRACT, functionName: "get_submission", args: [SUBMISSION_ID],
  }) as any;
  console.log(`  Status: ${sub.status} | Submitter: ${sub.submitter}\n`);

  // ── Step 2: Evaluate ──
  console.log("2. EVALUATE");
  await writeWithRetry(client, {
    address: CONTRACT,
    functionName: "evaluate",
    args: [SUBMISSION_ID],
    value: BigInt(0),
  }, "evaluate");

  const verdict = await client.readContract({
    address: CONTRACT, functionName: "get_verdict", args: [SUBMISSION_ID],
  }) as any;
  console.log(`  Risk: ${verdict.overall_risk}`);
  console.log(`  Confidence: ${verdict.confidence}`);
  console.log(`  Coverage: ${verdict.evidence_coverage}%`);
  console.log(`  Supported: ${verdict.supported_claims} | Unsupported: ${verdict.unsupported_claims} | Contradictions: ${verdict.contradictions}`);
  console.log(`  Material risks: ${verdict.material_risks.join("; ")}`);
  console.log(`  Summary: ${verdict.summary.slice(0, 200)}...\n`);

  // ── Step 3: Appeal ──
  console.log("3. APPEAL (with bond)");
  const rebuttal = `The verdict does not adequately account for MakerDAO/Sky's track record as the longest-running DeFi protocol. Key objections:

1. BATTLE-TESTED: MakerDAO has operated since 2017 and survived the March 2020 crash, the Terra/Luna collapse, and multiple market downturns. No other DeFi protocol has this longevity.

2. RWA STRATEGY: The RWA exposure is a deliberate diversification strategy that reduces crypto-only correlation risk. This should lower, not raise, the risk rating.

3. STABLECOIN DOMINANCE: DAI/USDS maintains its peg reliably. It's the largest decentralized stablecoin and serves as critical infrastructure for all of DeFi.

4. REBRAND: The Sky rebrand is cosmetic — underlying contracts, governance, and economic model are unchanged. It should not factor into risk assessment.`;

  await writeWithRetry(client, {
    address: CONTRACT,
    functionName: "appeal",
    args: [SUBMISSION_ID, rebuttal],
    value: BOND,
  }, "appeal");

  await new Promise(r => setTimeout(r, 5000));
  let appeal: any;
  for (let i = 0; i < 5; i++) {
    try {
      appeal = await client.readContract({
        address: CONTRACT, functionName: "get_appeal", args: [SUBMISSION_ID],
      });
      break;
    } catch {
      console.log(`  get_appeal not yet visible, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (appeal) {
    console.log(`  Bond: ${appeal.bond_wei} wei`);
    console.log(`  Adjudicated: ${appeal.adjudicated}`);
    console.log(`  Overturned: ${appeal.overturned}\n`);
  } else {
    console.log(`  Warning: appeal not visible yet, proceeding...\n`);
  }

  // ── Step 4: Adjudicate ──
  console.log("4. ADJUDICATE");
  await writeWithRetry(client, {
    address: CONTRACT,
    functionName: "adjudicate",
    args: [SUBMISSION_ID],
    value: BigInt(0),
  }, "adjudicate");

  // ── Final state ──
  const finalAppeal = await client.readContract({
    address: CONTRACT, functionName: "get_appeal", args: [SUBMISSION_ID],
  }) as any;
  const finalVerdict = await client.readContract({
    address: CONTRACT, functionName: "get_verdict", args: [SUBMISSION_ID],
  }) as any;
  const finalSub = await client.readContract({
    address: CONTRACT, functionName: "get_submission", args: [SUBMISSION_ID],
  }) as any;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`  FINAL RESULTS`);
  console.log(`${"=".repeat(50)}`);
  console.log(`  Status:       ${finalSub.status}`);
  console.log(`  Adjudicated:  ${finalAppeal.adjudicated}`);
  console.log(`  Overturned:   ${finalAppeal.overturned}`);
  console.log(`  Bond refunded:${finalAppeal.refunded}`);
  console.log(`  ---`);
  console.log(`  Risk:         ${finalVerdict.overall_risk}`);
  console.log(`  Confidence:   ${finalVerdict.confidence}`);
  console.log(`  Coverage:     ${finalVerdict.evidence_coverage}%`);
  console.log(`  Supported:    ${finalVerdict.supported_claims}`);
  console.log(`  Unsupported:  ${finalVerdict.unsupported_claims}`);
  console.log(`  Contradictions:${finalVerdict.contradictions}`);
  console.log(`  Risks:        ${finalVerdict.material_risks.join("; ")}`);
  console.log(`  Summary:      ${finalVerdict.summary.slice(0, 300)}`);
  console.log(`${"=".repeat(50)}`);

  process.exit(0);
}
main();
