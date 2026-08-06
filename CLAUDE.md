# OracleBoard AI — repo notes for future sessions

Consensus due diligence platform. Python Intelligent Contract at
`contracts/oracle_board.py`, Next.js 15 app at the repo root, deploys to
GenLayer via `scripts/deploy.ts` (writes address into `.env.local`).

## Ground rules
- **Never bypass consensus.** All verdicts must go through
  `gl.eq_principle.prompt_comparative` — no `strict_eq` on LLM outputs.
- **Every write compares the bucketed signature, not the prose.** If you touch
  `_consensus_signature` you must update both `evaluate` and `reevaluate`.
- **HTTPS-only, no private hosts.** Every URL passes through `_sanitize_url`.
- **Frontend never trusts the client wallet with anything but its own submissions.** All read paths go through `oracleboard.ts`.

## Layout
- `contracts/oracle_board.py` — Intelligent Contract, dependencies pinned in the header.
- `lib/genlayer/` — client factory, chain config, typed contract wrapper.
- `components/domain/` — verdict card, evidence explorer, timeline, submission table.
- `components/ui/` — shadcn-style primitives (button, card, dialog, tabs, ...).
- `app/` — Next.js 15 App Router pages.
- `scripts/deploy.ts` — publishes the contract, updates `.env.local`.

## Common tasks
- Add a new verdict dimension → update the prompt, `_consensus_signature`,
  the `Verdict` dataclass storage fields, and `VerdictCard`.
- Change chain default → edit `NEXT_PUBLIC_GENLAYER_CHAIN` in `.env.example`
  and the `CLIENT_CHAIN` fallback in `lib/genlayer/config.ts`.
