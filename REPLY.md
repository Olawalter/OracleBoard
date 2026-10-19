# Reply to the steward: bonded challenge / appeal remediation

## 1. Steward request

> The bonded challenge and appeal flow is incomplete: successful outcomes mark bonds as refunded without returning the posted value or providing a withdrawal path, and unresolved dispute records can be overwritten or conflict. Please implement and test a verifiable refund or withdrawal path, prevent new challenges or appeals from conflicting with an unresolved dispute, and make the user-facing refund claims match the implemented behavior.

Three concerns, each addressed below:

1. Refunds were recorded as a flag with no payment or withdrawal path.
2. Unresolved challenge / appeal records could be overwritten or conflict.
3. UI and docs claimed refunds that the contract never made.

All changes are in the existing repo; nothing was rebuilt. Contract enforcement is on-chain; the frontend only reads state and submits transactions.

## 2. Root causes

| # | Original behavior | Root cause (file / function) | Change |
|---|---|---|---|
| A | A changed verdict set `bond_refunded` / `refunded = True`. No value moved and no withdrawal existed. | `contracts/oracle_board.py` `reevaluate` and `adjudicate`: the transfer lines were commented out (`# gl.message.send(...)`), the boolean was the only effect. | Resolution now settles the bond into a claimable entitlement or a forfeiture; `claim_refund` pays it (section 3). |
| A2 | Bond could be sent but the methods were not declared payable. | `challenge` / `appeal` were `@gl.public.write`. | Now `@gl.public.write.payable`. |
| A3 | (Found while reviewing the sibling Inquest contract.) A payable call that raises keeps its attached GEN inside the contract on StudioNet, so a rejected challenge/appeal would have locked the sender's bond. | Validation in `challenge` / `appeal` used `raise gl.vm.UserError`. | Payable methods never raise once value is attached: they return `{"ok": false, "reason": ...}` and emit a refund of the exact attached value (`_refuse`). |
| B | A second `challenge` replaced the first; challenges and appeals could run concurrently. | `challenges` / `appeals` were keyed by `submission_id`; `challenge` had no active-dispute check, `appeal` only checked "already filed". | Per-dispute keys `<submission>#<n>`, plus one-unresolved-dispute rule (section 4). |
| C | UI showed "bond refunded" badges and "refunded if…" copy. | `app/submissions/[id]/page.tsx` read `bond_refunded` / `refunded`; README said the same. | Labels derive from `refund_due` / `refund_claimed` / `forfeited` (section 5). |

### 2a. Consensus signature change (found during live testing)

On StudioNet, `evaluate` returned UNDETERMINED on 5/5 attempts (twice, on the first deployment) with validators voting `disagree` and empty stderr. The cause was the equivalence signature: validators had to match exactly on risk level, confidence, coverage bucket and three claim-count buckets. I narrowed it (`_consensus_signature`, `_verdict_key`) to **risk tier** (low/moderate, elevated, high/severe) and **confidence band**; counts, coverage and prose are stored but not compared. `gl.eq_principle.prompt_comparative` is still used.

The same `_verdict_key` now decides whether a challenge/appeal "changed the verdict" (and so whether the bond is refunded), so the money decision rests only on fields validators agreed on. **Behavior change:** a move between levels inside one tier (e.g. moderate -> low) no longer refunds the bond; it forfeits it. This is a product-rule decision I made; reverting it means reverting the signature too.

## 3. Refund implementation (claimable refund, not immediate)

Chosen: **claimable refund**. Resolution is a consensus (non-deterministic) transaction; keeping payment as a separate, plain, authenticated call keeps the money path deterministic and lets resolution stay free of transfers.

- **Receipt:** `challenge` / `appeal` use `_accept_bond`, which takes `gl.message.value` (never a caller-supplied amount) and requires at least `CHALLENGE_BOND_WEI` / `APPEAL_BOND_WEI` (0.001 GEN, the pre-existing minimum). The recorded `bond_wei` is the value actually received, so an overpayment is recorded and refunded in full. The depositor is `gl.message.sender_address` (`challenger` / `appellant`).
- **Eligibility (unchanged rule):** verdict risk or confidence bucket changed after `reevaluate` / `adjudicate`. `_settle_bond` then sets `refund_due = bond_wei`; otherwise `forfeited = bond_wei`. It refuses to run if any of `refund_due`, `refund_claimed`, `forfeited` is already non-zero, and is only reached behind the `resolved` / `adjudicated` guards.
- **Withdrawal:** `claim_refund(kind, submission_id, index=0)` (`kind` is `"challenge"` or `"appeal"`; index 0 means latest). Requires: caller is the depositor, `refund_due > 0`, amount within `refund_liability` and the contract `balance`. It zeroes `refund_due`, increases `refund_claimed`, updates the ledger, then calls `_pay`. `claim_refund` carries no value, so its `UserError`s are safe and roll the call back.
- **How GEN is sent (`_pay`):** `_Recipient(addr).emit_transfer(value=..., on="finalized")` where `_Recipient` is declared with the SDK's EVM-style `contract_interface`. This follows the sibling Inquest contract (`contracts/inquest.py`, `docs/ARCHITECTURE.md`), which measured on StudioNet that a normal GenVM message (`gl.get_contract_at(...).emit_transfer`) to an ordinary account fails with "Contract not found" and never credits it, while the EVM-style plain send credits any address and lands when the emitting transaction finalizes. My first draft used `get_contract_at(...)`; it was replaced. The same send is used for refusal refunds.
- **Ledger (`get_accounting`):** `deposited_total = pending_bonds + refund_liability + refunded_total + forfeited_total`; `balance` is the contract's native balance. Tests assert both this identity and `balance >= pending + liability + forfeited` after every scenario.
- **Duplicate protection:** second claim reverts with `no refund available to claim`; repeat resolution reverts (`challenge already resolved`, `appeal already adjudicated`).
- **What counts as proof of payment:** `refund_claimed` records that the claim ran and the transfer was *emitted*. Per the SDK docs the emitted message defaults to `on='finalized'`, so funds reach the depositor when the claim transaction finalizes. Confirming receipt means checking the depositor's balance after finalization; the contract does not (and cannot) observe delivery.
- **Forfeited bonds** stay in the contract and are counted in `forfeited_total`. No owner withdrawal was added: the product spec does not define one, and inventing one was out of scope.

## 4. Challenge and appeal integrity

- `_active_dispute(sid)` returns `"challenge"` (latest challenge unresolved), `"appeal"` (latest appeal not adjudicated) or `""`.
- `challenge` refuses with `an unresolved challenge already exists…` or `an unresolved appeal exists…`; `appeal` refuses with `an unresolved challenge exists…`. "Refuses" means the call returns `{"ok": false, "reason": ...}` instead of raising (see A3), after every check has run and before any write; the attached value is returned through an emitted send (tests assert the exact `(recipient, amount)` emission and unchanged balances).
- Records live under `<submission>#<n>`; `challenge_counts` / `appeal_counts` hold the latest index. `get_challenge(sid, index=0)` / `get_appeal(...)` read any historical record (0 = latest), so a new dispute never overwrites an older one.
- `reevaluate` / `adjudicate` act only on the latest record of their own kind, and revert when none is open.
- Appeal remains once per submission (pre-existing rule, `appeal already filed`). A new challenge is allowed after the previous one resolves (history kept); an appeal is allowed after a resolved challenge.
- Independent submissions never block each other (`test_independent_subjects_do_not_conflict`).

Design decision to flag: "conflict" is scoped per submission and across the challenge/appeal pair, because both rewrite the single stored verdict. Allowing both at once would let the second resolution overwrite the first's outcome.

## 5. User-facing behavior

- `lib/refund.ts` maps contract fields to labels: *bond held, dispute unresolved* → *refund available to claim (not yet paid)* → *refund claimed, payout transfer emitted* / *bond forfeited*. A pending entitlement is never labelled "refunded".
- `app/submissions/[id]/page.tsx`: bond status block on the challenge and appeal cards; a **Claim refund** button shown only when the connected (browser-local) account equals the depositor and the phase is claimable; a non-depositor sees a "only the depositor can claim" note. Challenge / Appeal buttons are hidden while a dispute is open (convenience only; the contract enforces it). Failed claims show "nothing was paid". The success toast says the transfer was emitted and arrives on finalization.
- Because a refused challenge/appeal does not raise, the transaction looks successful. `oracleBoard.challenge` / `appeal` in `lib/genlayer/oracleboard.ts` therefore compare `get_dispute_state` counters before and after the write and throw a "contract refused, bond returned on finalization" error if nothing was recorded. The specific refusal reason is not shown in the UI (the receipt return value is not decoded); it is returned by the contract call.
- Data comes from contract reads (`get_challenge`, `get_appeal`, `get_dispute_state`) and is refreshed after each write. The app signs with a browser-local `genlayer-js` account (pre-existing design), not an external wallet.
- Corrected copy: challenge and appeal dialogs, README bond section, e2e script log lines. Removed "symbolic on StudioNet" wording from the appeal card.
- Not changed: the write helper still resolves at ACCEPTED/FINALIZED as before; the UI does not poll the recipient balance.

## 6. GenLayer-native notes

- Used: `gl.Contract`, `@gl.public.write.payable`, `gl.message.value`, `gl.message.sender_address`, `gl.vm.UserError`, `TreeMap`, `u256` / `u32`, and the EVM-style `contract_interface` send (`genlayer.gl.evm`, with the `genlayer.gl._internal.eth` fallback import as in Inquest). The non-deterministic verdict logic (`gl.eq_principle.prompt_comparative` over the bucketed signature) is untouched; no LLM calls were added to bookkeeping.
- Consulted: the sibling Inquest project (`contracts/inquest.py` `_pay` / `_refuse`, `docs/ARCHITECTURE.md`) for the payout and refusal pattern; GenLayer SDK API reference (https://sdk.genlayer.com/main/_static/ai/api.txt, payable and transfer sections), and the installed SDK source (v0.3.0-rc7 in the `gltest` cache) for `emit_transfer`, `Contract.balance` and `payable`. I did not consult the other reference repositories or the GenLayer skill/MCP.
- Limits: the Inquest findings (raising payable tx keeps its value; plain send needed for EOAs) are measurements by that project on StudioNet that I have not reproduced here. The SDK docs do not spell out which emitted messages are discarded on rollback, so `claim_refund` updates state first and relies on `UserError` aborting the whole call before any emission. `_pay` skips zero amounts.

## 7. Tests and verification

| Area | Command | Result | Evidence / limitation |
|---|---|---|---|
| Contract lint | `genvm-lint check contracts/oracle_board.py --json` (WSL) | Passed | `ok: true`, 3 lint checks, validates 14 methods. Run after the final contract change. An earlier run flagged `_count` as a static method (E022); fixed. Only note: a newer py-genlayer runner exists (I200). |
| Direct tests | `pytest tests/direct` (WSL) | Passed, 69 | 34 original (edited where payable rejections now return a refusal instead of raising) + 35 new (incl. 3 for the tier rule). Fails at setup on native Windows due to a temp-file lock in the test harness. |
| Refund / withdrawal | `tests/direct/test_bonds_and_disputes.py` (`TestBondReceipt`, `TestChallengeRefund`, `TestAppealRefund`, `TestIndependentBondsAndAggregate`) | Passed | **Balances are simulated by a test helper** (`Ledger`): the direct VM neither credits `ctx.value` nor executes the emitted `EthSend`. Tests prove the contract emits exactly the right transfer to the right account once, and that ledger identities hold. They do not prove chain delivery. |
| Dispute integrity | `TestChallengeConflicts`, `TestAppealConflicts` | Passed | Conflicting challenge/appeal rejected, records unchanged, rejected bonds returned, independent subjects work, history kept. |
| Mutation check | Removed the `refund_due` zeroing and the active-challenge guard, reran new tests (on the final contract) | 4 tests failed, as intended | Contract restored (byte-identical). |
| Integration tests | none | Not run | The repo has no `tests/integration`. |
| Frontend | `npm run typecheck`, `npm run test:ui`, `npm run build` | Passed | `test:ui` is a new tsx script covering label/claimability logic only. `npm run lint` fails because `next lint` no longer exists in the installed Next 16 (pre-existing, not addressed). |
| Live verification | `npx tsx scripts/live_refund_check.ts` against StudioNet contract `0x13e97ade9CAE0C1f8BA875dBE2edB28cFa5EBe2D` | **Verified (one run)** | See section 7a. |

### 7a. Live StudioNet run

Deployed with `npm run deploy:contract -- --chain=studionet` (deployer is a throwaway account; tx `0x1a74b6cc643e8af1c66b707d7b19294e8375d38033c1d1825eb30b5004b087af`). Address: **`0x13e97ade9CAE0C1f8BA875dBE2edB28cFa5EBe2D`**. A first deployment (`0xcA5Ea7c8a587D7e4734b6930aE85606973908619`, before the signature fix) is obsolete.

`scripts/live_refund_check.ts` used two throwaway accounts funded with 5 GEN each via `sim_fundAccount`, submission id `live-mvfq4ku5`:

| Step | Observed |
|---|---|
| `submit`, `evaluate` | First `evaluate` UNDETERMINED (during RPC timeouts); second accepted, verdict `elevated`. |
| `challenge` (account B, 0.001 GEN) | `get_dispute_state` -> active `challenge`, count 1; contract balance 0.001 GEN. |
| Conflicting `challenge` (account A, 0.001 GEN) | Refused: challenge_count stayed 1. Account A was debited at first sample, and at the end both accounts were exactly 5 GEN again and the contract held 0, so the value was returned. |
| `reevaluate` | Challenge resolved with `refund_due = 1000000000000000`, `forfeited = 0` (nothing paid yet). |
| `claim_refund` by B | B's on-chain balance 4.999 -> 5.000 GEN (delta exactly the 0.001 GEN bond); `refund_due = 0`, `refund_claimed = 1000000000000000`. |
| Second `claim_refund` | `refund_claimed` unchanged; no further payout. |
| Final `get_accounting` | deposited 0.001, refunded 0.001, pending/liability/forfeited 0, contract balance 0. |

Limits of this evidence: a single run; the forfeiture path, the appeal path, and non-depositor claims were not exercised live (they are covered only by the simulated-ledger direct tests); StudioNet is a test network; balances were read with `eth_getBalance` on Studio's RPC; the script hit transient RPC timeouts, which it retried.

Install note: `npm ci` fails on the existing lockfile (missing optional platform entries, pre-existing); I used `npm install --no-package-lock`, so the lockfile is unchanged.

## 8. Deployment and compatibility

- **Deployed:** StudioNet `0x13e97ade9CAE0C1f8BA875dBE2edB28cFa5EBe2D` (README updated). `.env.local` (gitignored) holds it locally; set `NEXT_PUBLIC_ORACLEBOARD_ADDRESS` in any hosted environment.
- **Redeploy was required and has been done for StudioNet; any other network needs its own deploy.** Storage layout (new fields, count maps, ledger) and view return shapes changed (`bond_refunded` / `refunded` removed in favour of `refund_due` / `refund_claimed` / `forfeited`; `index` added). An already-deployed contract is not changed by these source edits and cannot be migrated in place; bonds held in the old contract have no claim path.
- Frontend and any script calling `challenge` / `appeal` must treat a returned `ok: false` as a refusal, not a revert (the bundled UI does, via counter comparison).
- After deploying, run `npm run deploy:contract`, which writes the new address into `.env.local`.
- The pinned `py-genlayer` runner in the contract header passed `genvm-lint` validation and the EVM-style send delivered real value on StudioNet (section 7a). Testnet (Asimov/Bradbury) behavior is unverified.

## 9. Checklist

- [x] Verifiable refund / withdrawal path exists and is tested (`claim_refund`; 65 direct tests).
- [x] Fund movement: verified on StudioNet for the challenge -> refund claim path (recipient balance +0.001 GEN, refused-challenge value returned, double claim paid nothing); forfeiture, appeal and non-depositor paths are simulated-ledger only.
- [x] Duplicate payouts and unauthorized withdrawals prevented (tests + mutation check).
- [x] Conflicting challenges and appeals rejected at the contract level.
- [x] Unresolved records cannot be overwritten through public methods (per-dispute keys; guards).
- [x] Independent disputes still work.
- [x] UI / README refund claims match behavior (label logic unit-tested; not exercised against a live contract).
- [~] Lint and direct tests passed; typecheck, UI test and build passed; no integration tests exist; `next lint` unavailable.
- [x] Deployment limits documented (section 8).
- [~] Live verification: one StudioNet run (section 7a). Not run on any testnet; single run only.
