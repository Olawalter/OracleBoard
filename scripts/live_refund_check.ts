/**
 * Live StudioNet check of the bond / refund flow against the deployed contract.
 *
 *   npx tsx scripts/live_refund_check.ts
 *
 * Uses two throwaway accounts funded through Studio's sim_fundAccount. The
 * verdict change after `reevaluate` depends on live validators/LLM, so the
 * script reports whichever outcome (claimable refund or forfeiture) occurred
 * and only claims when a refund is actually due.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const CONTRACT = process.env.NEXT_PUBLIC_ORACLEBOARD_ADDRESS as `0x${string}`;
const RPC = studionet.rpcUrls.default.http[0];
const BOND = 1_000_000_000_000_000n;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TAG = Date.now().toString(36);
const SID = `live-${TAG}`;

const NAMES: Record<number, string> = { 5: "ACCEPTED", 6: "UNDETERMINED", 7: "FINALIZED", 8: "CANCELED", 12: "VALIDATORS_TIMEOUT", 13: "LEADER_TIMEOUT" };

async function retry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw e;
      console.log(`  network error, retry ${i}/${tries}:`, String((e as Error).message).slice(0, 80));
      await sleep(5000 * i);
    }
  }
}

async function rpc(method: string, params: unknown[]) {
  return retry(() => rpcOnce(method, params));
}
async function rpcOnce(method: string, params: unknown[]) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  return (await res.json()) as { result?: unknown; error?: { message: string } };
}
const balanceOf = async (addr: string) => BigInt((await rpc("eth_getBalance", [addr, "latest"])).result as string);

async function main() {
  const A = createAccount();
  const B = createAccount();
  const ca = createClient({ chain: studionet, account: A });
  const cb = createClient({ chain: studionet, account: B });
  for (const acc of [A, B]) console.log("fund", acc.address, JSON.stringify(await rpc("sim_fundAccount", [acc.address, 5_000_000_000_000_000_000])));

  const read = (c: any, fn: string, args: unknown[] = []) => retry(() => c.readContract({ address: CONTRACT, functionName: fn, args }));
  async function write(c: any, fn: string, args: unknown[], value = 0n) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const hash = await retry(() => c.writeContract({ address: CONTRACT, functionName: fn, args, value, leaderOnly: false }));
      console.log(`  ${fn} tx ${hash}`);
      for (let i = 0; i < 120; i++) {
        await sleep(8000);
        let tx: any;
        try { tx = await c.getTransaction({ hash }); } catch (e) { console.log("  poll error (retrying):", String((e as Error).message).slice(0, 120)); continue; }
        const s = NAMES[tx.status as number] ?? String(tx.status);
        if (s === "ACCEPTED" || s === "FINALIZED") return { hash, status: s };
        if (s === "UNDETERMINED") { console.log("  UNDETERMINED, retrying"); break; }
        if (["CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(s)) throw new Error(s);
      }
    }
    throw new Error(`${fn} did not settle`);
  }

  console.log("contract", CONTRACT, "accounting:", JSON.stringify(await read(ca, "get_accounting"), (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  await write(ca, "submit", [SID, "LiveCheck Co", "live refund check", ["LiveCheck Co is a registered Delaware C-corp founded in 2021 with 14 employees.","Audited FY2024 financials: revenue USD 2.1M, gross margin 62%, cash USD 1.4M, burn USD 90k/month (18 months runway).","Product: B2B invoicing software, 120 paying customers, 94% annual retention, SOC 2 Type II completed in 2024.","Roadmap: two shipped milestones in 2024, next release scheduled Q2 2025. No pending litigation. Founders hold 61% equity."].join(" "), []]);
  await write(ca, "evaluate", [SID]);
  console.log("verdict:", (await read(ca, "get_verdict", [SID])).overall_risk);

  const bBefore = await balanceOf(B.address);
  await write(cb, "challenge", [SID, "new_evidence", "New evidence: audited financials show materially lower risk than assessed. ".repeat(2), "reason"], BOND);
  let st = await read(ca, "get_dispute_state", [SID]);
  console.log("after challenge:", JSON.stringify(st), "contract bal:", (await read(ca, "get_accounting")).balance);

  // Conflicting challenge by the other account must be refused and its value returned.
  const aBefore = await balanceOf(A.address);
  await write(ca, "challenge", [SID, "new_evidence", "Second competing challenge evidence that should be refused. ".repeat(2), "x"], BOND);
  st = await read(ca, "get_dispute_state", [SID]);
  console.log("after conflicting challenge:", JSON.stringify(st), "(challenge_count must still be 1)");
  await sleep(15000);
  console.log("conflicting sender balance delta (should be ~0):", (await balanceOf(A.address) - aBefore).toString());

  await write(cb, "reevaluate", [SID]);
  const c = await read(cb, "get_challenge", [SID]);
  console.log("challenge after reevaluate:", JSON.stringify(c, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));

  if (BigInt(c.refund_due) > 0n) {
    const before = await balanceOf(B.address);
    await write(cb, "claim_refund", ["challenge", SID, 0]);
    await sleep(20000);
    const after = await balanceOf(B.address);
    console.log(`CLAIM: balance ${before} -> ${after} (delta ${after - before}, bond ${BOND})`);
    const c2 = await read(cb, "get_challenge", [SID]);
    console.log("post-claim:", JSON.stringify(c2, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    try { await write(cb, "claim_refund", ["challenge", SID, 0]); const c3 = await read(cb, "get_challenge", [SID]); console.log("second claim refund_claimed (must be unchanged):", c3.refund_claimed.toString()); } catch (e) { console.log("second claim errored:", (e as Error).message); }
  } else {
    console.log("Verdict was upheld -> bond forfeited, no refund due (valid outcome). bB delta:", (await balanceOf(B.address) - bBefore).toString());
  }
  console.log("final accounting:", JSON.stringify(await read(ca, "get_accounting"), (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

main().catch((e) => { console.error("LIVE CHECK FAILED:", e); process.exit(1); });
