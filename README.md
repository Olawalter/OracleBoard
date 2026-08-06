# OracleBoard AI

**Consensus-based public-project due diligence on GenLayer.**

OracleBoard lets anyone open a due-diligence dossier on a crypto project — token launch, DAO grant proposal, open-source protocol, or fund. Independent AI validators each fetch the cited URLs from inside their own sandbox, grade the evidence across eight dimensions, and only persist a verdict when their bucketed signatures agree. The result is tamper-resistant, multi-validator analysis stored on-chain.

---

## Why GenLayer

OracleBoard uses three GenLayer primitives that have no clean equivalent elsewhere:

| Primitive | How it's used |
|---|---|
| `gl.nondet.web.get()` | Each validator independently fetches cited HTTPS URLs from inside its sandbox — no shared oracle, no off-chain fetch |
| `gl.nondet.exec_prompt()` | Validators run the analysis prompt independently; outputs are compared, not averaged |
| `gl.eq_principle.prompt_comparative()` | Consensus is reached over bucketed numeric signatures, not raw LLM prose — so validators can phrase verdicts differently and still agree |

This is a genuine fit: the core problem (independent multi-party analysis with a single accepted result) maps directly to how GenLayer consensus works.

---

## Architecture

```
contracts/oracle_board.py   ← Intelligent Contract (Python, GenLayer)
lib/genlayer/               ← genlayer-js client, chain config, typed wrapper
lib/hooks/                  ← React hooks (useSubmissionBundle, useSubmissionList)
components/domain/          ← VerdictCard, EvidenceExplorer, ConsensusTimeline, SubmissionTable
components/ui/              ← shadcn-style primitives
app/                        ← Next.js 15 App Router pages
scripts/deploy.ts           ← Deploy contract, write address to .env.local
scripts/full_e2e_test.ts    ← CLI end-to-end test (submit → evaluate → appeal → adjudicate)
tests/direct/               ← glsim in-memory unit tests (36 tests, no network)
```

---

## Contract methods

| Method | Type | Description |
|---|---|---|
| `submit` | write | Open a new dossier with evidence and HTTPS URLs |
| `evaluate` | write | Run validators; store accepted consensus verdict |
| `challenge` | write | Open a challenge (new evidence or factual error) |
| `reevaluate` | write | Re-run validators incorporating challenge evidence |
| `appeal` | write | Original submitter posts a bond + rebuttal for secondary review |
| `adjudicate` | write | Run appeal validators; overturn verdict if risk/confidence bucket changes |
| `get_submission` | view | Fetch submission metadata |
| `get_verdict` | view | Fetch stored consensus verdict |
| `get_challenge` | view | Fetch active challenge |
| `get_appeal` | view | Fetch appeal record |
| `list_submissions` | view | Paginated list of all dossiers |

### Consensus signature

Validators agree on a bucketed numeric fingerprint — not on prose:

```python
{
  "risk": _score_risk(overall_risk),         # 0–4
  "conf": _score_confidence(confidence),     # 0–2
  "cov":  _bucket_coverage(evidence_pct),    # 0–5 (per 20%)
  "sup":  _bucket_count(supported_claims),   # 0–4
  "uns":  _bucket_count(unsupported_claims), # 0–4
  "con":  _bucket_count(contradictions),     # 0–4
}
```

Validators can write different summaries, different material-risk phrases, and different follow-up items — they only need to agree on the numbers.

### Appeal bond

`APPEAL_BOND_WEI = 1_000_000_000_000_000` (0.001 GEN). Only the original submitter can appeal. If adjudication changes the risk or confidence bucket, the bond is refunded. On StudioNet the bond is symbolic — all transactions are gasless.

---

## Getting started

### Prerequisites

- Node.js 20+, pnpm 9+
- Python 3.12+ with `gltest` / `glsim` installed (`pip install genlayer-test`)

### Install

```bash
git clone https://github.com/Olawalter/OracleBoard
cd OracleBoard
pnpm install
```

### Configure

Copy the example env and fill in values:

```bash
cp .env.example .env.local
```

Key variables:

```
NEXT_PUBLIC_GENLAYER_CHAIN=studionet          # or localnet / testnet-asimov
NEXT_PUBLIC_ORACLEBOARD_ADDRESS=0x...         # written by deploy script
DEPLOYER_PRIVATE_KEY=0x...                    # optional; fresh account used if omitted
```

### Deploy the contract

```bash
pnpm deploy:contract
# Deploys to studionet by default; writes address to .env.local
```

### Run the app

```bash
pnpm dev
# Opens http://localhost:3000
```

### Run unit tests (no network required)

```bash
python -m pytest tests/direct/ -v
# 36 tests — submit, evaluate, challenge, reevaluate, appeal, adjudicate, views
```

### Run the CLI end-to-end test

```bash
npx tsx scripts/full_e2e_test.ts
# Submits a MakerDAO dossier, evaluates, appeals, adjudicates — prints final state
```

---

## Dossier lifecycle

```
pending → [evaluate] → resolved
                     → [challenge] → challenged → [reevaluate] → resolved
                     → [appeal]    → appealed   → [adjudicate] → resolved
```

The `appeal` step requires a 0.001 GEN bond from the original submitter. `adjudicate` runs a secondary validator panel with the rebuttal included in the prompt; validators are explicitly told to treat it as potentially biased advocacy. If the risk or confidence bucket shifts, the appeal is overturned and the bond is refunded.

---

## Live deployment

- **Network:** StudioNet (chain ID 61999)
- **Contract:** `0xBa82bF5411379bb38Fa44498382f02edDF4Aa2c3`
- **Verified dossiers:** Aave v3, Compound Finance v3, MakerDAO/Sky (×2 via CLI E2E)

---

## Security constraints (enforced in code)

- All verdicts go through `gl.eq_principle.prompt_comparative` — no `strict_eq` on LLM outputs.
- Every write compares the bucketed signature, not prose — `_consensus_signature` is the single source of truth for `evaluate`, `reevaluate`, and `adjudicate`.
- HTTPS-only, no private hosts — every URL passes through `_sanitize_url` before storage or fetch.
- Frontend never trusts the client wallet with anything but its own submissions — all read paths go through `oracleboard.ts`.
- Contract errors use `gl.vm.UserError` (not bare `Exception`) — genvm-lint clean, zero warnings.
