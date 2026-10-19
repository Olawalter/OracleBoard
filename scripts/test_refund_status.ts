// Run with: npm run test:ui
import assert from "node:assert/strict";
import { bondLabel, bondPhase, canClaim, formatGen, type BondRecord } from "../lib/refund";

const BOND = 1_000_000_000_000_000;
const rec = (o: Partial<BondRecord> = {}): BondRecord => ({
  bond_wei: BOND, refund_due: 0, refund_claimed: 0, forfeited: 0, ...o,
});
const A = "0xAbC0000000000000000000000000000000000001";

// entitlement is not payment
assert.equal(bondPhase(rec({ refund_due: BOND }), true), "claimable");
assert.match(bondLabel(rec({ refund_due: BOND }), true), /available to claim.*not yet paid/);
assert.doesNotMatch(bondLabel(rec({ refund_due: BOND }), true), /refunded|claimed:/i);
// paid only after claim_refund ran
assert.equal(bondPhase(rec({ refund_claimed: BOND }), true), "claimed");
assert.match(bondLabel(rec({ refund_claimed: BOND }), true), /Refund claimed/);
// unresolved dispute never shows a refund state even if fields were somehow set
assert.equal(bondPhase(rec({ refund_due: BOND }), false), "held");
assert.equal(bondPhase(rec({ forfeited: BOND }), true), "forfeited");
assert.match(bondLabel(rec({ forfeited: BOND }), true), /forfeited/);
// claim button only for the depositor, only while claimable
assert.equal(canClaim(rec({ refund_due: BOND }), true, A, A.toLowerCase()), true);
assert.equal(canClaim(rec({ refund_due: BOND }), true, A, "0xdead"), false);
assert.equal(canClaim(rec({ refund_due: BOND }), true, A, null), false);
assert.equal(canClaim(rec({ refund_claimed: BOND }), true, A, A), false);
assert.equal(canClaim(rec({ forfeited: BOND }), true, A, A), false);
assert.equal(canClaim(rec({ refund_due: BOND }), false, A, A), false);
// exact formatting
assert.equal(formatGen(BOND), "0.001");
assert.equal(formatGen(3_000_000_000_000_000_000n), "3");
assert.equal(formatGen(1_000_000_000_000_007), "0.001000000000000007");
console.log("refund status tests passed");
