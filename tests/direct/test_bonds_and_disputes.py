"""Direct tests: bond accounting, claimable refunds, and dispute integrity.

The direct-test VM (gltest.direct) does not move native balances by itself:
it neither credits the contract with `ctx.value` nor executes the
`EthSend` a contract emits via the EVM-style `emit_transfer`. `Ledger` below does both,
so a test can assert real balance deltas for the depositor and the contract.
It models what the chain does (debit sender / credit contract on a payable
call, roll the debit back if the call reverts, apply emitted transfers). A
refused payable call does NOT revert (a raising tx keeps its value on
StudioNet), so the refund comes only from the contract's emitted transfer; it
does NOT prove the real chain delivers them -- see REPLY.md for that limit.
"""

import json
import re
from pathlib import Path

import pytest
from glsim.engine import VMContext, deploy_contract, create_address

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contracts" / "oracle_board.py"

BOND = 1_000_000_000_000_000
SID = "dossier-1"


def hexaddr(raw: bytes) -> str:
    """Lower-case 0x form of a raw 20-byte address (contract views return checksummed hex)."""
    return "0x" + raw.hex()

SUBMITTER = create_address("submitter")
CHALLENGER = create_address("challenger")
OTHER = create_address("other_user")


def _verdict(risk: str, conf: str = "medium") -> str:
    return json.dumps({
        "overall_risk": risk,
        "confidence": conf,
        "evidence_coverage": 45,
        "supported_claims": 5,
        "unsupported_claims": 3,
        "contradictions": 1,
        "material_risks": ["regulatory risk"],
        "follow_up": ["review audit report"],
        "summary": "mock verdict",
    })


class Ledger:
    """Balance bookkeeping around the direct VM (see module docstring)."""

    def __init__(self, ctx, board):
        self.ctx = ctx
        self.board = board
        self.contract = ctx._contract_address
        self.transfers = []  # (recipient_bytes, value)
        ctx._gl_call_hook = self._hook

    @staticmethod
    def _b(addr) -> bytes:
        return addr if isinstance(addr, bytes) else addr.as_bytes

    def bal(self, addr) -> int:
        return self.ctx._balances.get(self._b(addr), 0)

    def fund(self, addr, amount: int) -> None:
        self.ctx.deal(addr, self.bal(addr) + amount)

    def _hook(self, vm, request):
        # The contract pays through the EVM-style plain send -> "EthSend".
        msg = request.get("EthSend") if isinstance(request, dict) else None
        if msg is None:
            return None
        value = int(msg["value"])
        to = self._b(msg["address"])
        c = self._b(self.contract)
        assert vm._balances.get(c, 0) >= value, "contract cannot fund emitted transfer"
        vm._balances[c] = vm._balances.get(c, 0) - value
        vm._balances[to] = vm._balances.get(to, 0) + value
        self.transfers.append((to, value))
        return {"ok": None}

    def call(self, sender, value, fn, *args):
        """Run a (payable) write as `sender` sending `value`; rollback on revert."""
        before = dict(self.ctx._balances)
        sb, cb = self._b(sender), self._b(self.contract)
        assert self.bal(sender) >= value, "test sender underfunded"
        self.ctx._balances[sb] = self.bal(sender) - value
        self.ctx._balances[cb] = self.bal(self.contract) + value
        self.ctx.value = value
        try:
            with self.ctx.prank(sender):
                return fn(*args)
        except BaseException:
            self.ctx._balances.clear()
            self.ctx._balances.update(before)
            raise
        finally:
            self.ctx.value = 0


@pytest.fixture
def ctx():
    vm = VMContext(_sender=SUBMITTER)
    with vm.activate():
        yield vm


@pytest.fixture
def board(ctx):
    ctx.mock_llm(re.compile(r".*"), _verdict("elevated"))
    ctx.mock_web(re.compile(r"https://.*"), {"method": "GET", "status": 200, "body": "page"})
    return deploy_contract(CONTRACT_PATH, ctx)


@pytest.fixture
def ledger(ctx, board):
    led = Ledger(ctx, board)
    for who in (SUBMITTER, CHALLENGER, OTHER):
        led.fund(who, 10 * BOND)
    return led


def set_llm(ctx, risk: str, conf: str = "medium") -> None:
    ctx._llm_mocks.clear()
    ctx.mock_llm(re.compile(r".*"), _verdict(risk, conf))


def evaluated(ctx, board, sid=SID):
    set_llm(ctx, "elevated")
    with ctx.prank(SUBMITTER):
        board.submit(sid, "TestDAO", "summary", "evidence text", ["https://example.com/a"])
    board.evaluate(sid)


def open_challenge(ledger, sid=SID, who=CHALLENGER, value=BOND):
    return ledger.call(who, value, ledger.board.challenge, sid, "new_evidence", "x" * 40, "reason")


def open_appeal(ledger, sid=SID, who=SUBMITTER, value=BOND):
    return ledger.call(who, value, ledger.board.appeal, sid, "r" * 100)


def refused(result, text: str) -> None:
    """A refused payable call returns {ok: False, reason} instead of raising."""
    assert result["ok"] is False, result
    assert text in result["reason"], result


def assert_ledger_invariants(ledger):
    a = ledger.board.get_accounting()
    assert a["deposited_total"] == (
        a["pending_bonds"] + a["refund_liability"] + a["refunded_total"] + a["forfeited_total"]
    )
    # every bond not yet paid out is still physically held by the contract
    assert a["balance"] >= a["pending_bonds"] + a["refund_liability"] + a["forfeited_total"]
    assert a["balance"] == ledger.bal(ledger.contract)


# ───────────────────────── bond receipt ─────────────────────────

class TestBondReceipt:
    def test_records_value_actually_received(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger, value=BOND + 7)
        c = board.get_challenge(SID)
        assert c["bond_wei"] == BOND + 7
        assert c["challenger"].lower() == hexaddr(CHALLENGER)
        assert ledger.bal(ledger.contract) == BOND + 7
        assert ledger.bal(CHALLENGER) == 10 * BOND - (BOND + 7)
        assert board.get_accounting()["pending_bonds"] == BOND + 7
        assert_ledger_invariants(ledger)

    def test_missing_or_short_bond_rejected_without_side_effects(self, ctx, board, ledger):
        evaluated(ctx, board)
        for v in (0, BOND - 1):
            refused(open_challenge(ledger, value=v), "requires a bond")
        refused(open_appeal(ledger, value=BOND - 1), "requires a bond")
        with ctx.expect_revert("no challenge"):
            board.get_challenge(SID)
        assert board.get_accounting()["deposited_total"] == 0
        # the short bond came back through an emitted transfer, nothing stayed
        assert (CHALLENGER, BOND - 1) in ledger.transfers
        assert (SUBMITTER, BOND - 1) in ledger.transfers
        assert ledger.bal(ledger.contract) == 0
        assert ledger.bal(CHALLENGER) == 10 * BOND
        assert ledger.bal(SUBMITTER) == 10 * BOND

    def test_depositor_is_challenger_not_submitter(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        assert board.get_challenge(SID)["challenger"] != board.get_submission(SID)["submitter"]


# ───────────────────── refund / withdrawal path ─────────────────────

class TestChallengeRefund:
    def _upheld(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        board.reevaluate(SID)  # same mocked verdict -> unchanged

    def _overturned(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        set_llm(ctx, "low", "high")
        board.reevaluate(SID)

    def test_resolution_creates_entitlement_but_moves_no_funds(self, ctx, board, ledger):
        self._overturned(ctx, board, ledger)
        c = board.get_challenge(SID)
        assert c["resolved"] and c["refund_due"] == BOND and c["refund_claimed"] == 0
        assert ledger.transfers == []
        assert ledger.bal(CHALLENGER) == 10 * BOND - BOND  # not yet paid
        a = board.get_accounting()
        assert a["refund_liability"] == BOND and a["pending_bonds"] == 0
        assert_ledger_invariants(ledger)

    def test_claim_pays_exact_amount_once(self, ctx, board, ledger):
        self._overturned(ctx, board, ledger)
        ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        assert ledger.transfers == [(CHALLENGER, BOND)]
        assert ledger.bal(CHALLENGER) == 10 * BOND
        assert ledger.bal(ledger.contract) == 0
        c = board.get_challenge(SID)
        assert c["refund_due"] == 0 and c["refund_claimed"] == BOND
        a = board.get_accounting()
        assert a["refund_liability"] == 0 and a["refunded_total"] == BOND
        assert_ledger_invariants(ledger)

    def test_second_claim_cannot_pay_again(self, ctx, board, ledger):
        self._overturned(ctx, board, ledger)
        ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        with ctx.expect_revert("no refund available to claim"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        assert len(ledger.transfers) == 1
        assert ledger.bal(CHALLENGER) == 10 * BOND

    def test_only_depositor_can_claim(self, ctx, board, ledger):
        self._overturned(ctx, board, ledger)
        for who in (OTHER, SUBMITTER):
            with ctx.expect_revert("only the bond depositor"):
                ledger.call(who, 0, board.claim_refund, "challenge", SID)
        assert ledger.transfers == []
        assert board.get_challenge(SID)["refund_due"] == BOND

    def test_upheld_verdict_forfeits_and_is_not_claimable(self, ctx, board, ledger):
        self._upheld(ctx, board, ledger)
        c = board.get_challenge(SID)
        assert c["refund_due"] == 0 and c["forfeited"] == BOND
        with ctx.expect_revert("no refund available to claim"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        a = board.get_accounting()
        assert a["forfeited_total"] == BOND and a["refund_liability"] == 0
        assert ledger.bal(ledger.contract) == BOND
        assert_ledger_invariants(ledger)

    def test_claim_before_resolution_rejected(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        with ctx.expect_revert("no refund available to claim"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        assert ledger.transfers == []

    def test_claim_with_unknown_target_or_kind_rejected(self, ctx, board, ledger):
        evaluated(ctx, board)
        with ctx.expect_revert("no challenge"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        with ctx.expect_revert("no appeal"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "appeal", SID)
        with ctx.expect_revert("kind must be"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "other", SID)
        with ctx.expect_revert("no challenge"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID, 9)

    def test_repeated_resolution_cannot_duplicate_refund(self, ctx, board, ledger):
        self._overturned(ctx, board, ledger)
        with ctx.expect_revert("challenge already resolved"):
            board.reevaluate(SID)
        assert board.get_challenge(SID)["refund_due"] == BOND
        assert board.get_accounting()["refund_liability"] == BOND

    def test_refund_cannot_exceed_balance(self, ctx, board, ledger):
        """If the contract were ever underfunded the claim reverts atomically."""
        self._overturned(ctx, board, ledger)
        ctx.deal(ledger.contract, BOND - 1)  # simulate a (should-be-impossible) shortfall
        with ctx.expect_revert("contract cannot cover this refund"):
            ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        c = board.get_challenge(SID)
        assert c["refund_due"] == BOND and c["refund_claimed"] == 0
        assert ledger.transfers == []

    def test_overpaid_bond_is_refunded_in_full(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger, value=3 * BOND)
        set_llm(ctx, "low", "high")
        board.reevaluate(SID)
        ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", SID)
        assert ledger.transfers == [(CHALLENGER, 3 * BOND)]
        assert ledger.bal(CHALLENGER) == 10 * BOND
        assert_ledger_invariants(ledger)


class TestVerdictChangeDefinition:
    """Refund eligibility depends only on the validator-agreed fields: risk
    tier (low/moderate | elevated | high/severe) and confidence band."""

    def test_adjacent_risk_level_in_same_tier_is_not_a_change(self, ctx, board, ledger):
        evaluated(ctx, board)  # elevated / medium -> tier 1
        open_challenge(ledger)
        set_llm(ctx, "elevated", "medium")
        board.reevaluate(SID)
        assert board.get_challenge(SID)["forfeited"] == BOND

    def test_low_vs_moderate_same_tier_not_a_change(self, ctx, board, ledger):
        set_llm(ctx, "moderate", "high")
        with ctx.prank(SUBMITTER):
            board.submit(SID, "Co", "s", "e", [])
        board.evaluate(SID)
        open_challenge(ledger)
        set_llm(ctx, "low", "high")
        board.reevaluate(SID)
        assert board.get_challenge(SID)["forfeited"] == BOND

    def test_tier_or_confidence_change_is_a_change(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        set_llm(ctx, "elevated", "high")  # same tier, confidence moved
        board.reevaluate(SID)
        assert board.get_challenge(SID)["refund_due"] == BOND


class TestAppealRefund:
    def test_overturned_appeal_refund_claim(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_appeal(ledger)
        set_llm(ctx, "low", "high")
        board.adjudicate(SID)
        a = board.get_appeal(SID)
        assert a["overturned"] and a["refund_due"] == BOND
        assert ledger.transfers == []
        ledger.call(SUBMITTER, 0, board.claim_refund, "appeal", SID)
        assert ledger.transfers == [(SUBMITTER, BOND)]
        assert ledger.bal(SUBMITTER) == 10 * BOND
        assert board.get_appeal(SID)["refund_claimed"] == BOND
        with ctx.expect_revert("no refund available to claim"):
            ledger.call(SUBMITTER, 0, board.claim_refund, "appeal", SID)
        assert_ledger_invariants(ledger)

    def test_upheld_appeal_forfeits(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_appeal(ledger)
        board.adjudicate(SID)  # same verdict -> upheld
        a = board.get_appeal(SID)
        assert not a["overturned"] and a["forfeited"] == BOND and a["refund_due"] == 0
        with ctx.expect_revert("no refund available to claim"):
            ledger.call(SUBMITTER, 0, board.claim_refund, "appeal", SID)
        assert_ledger_invariants(ledger)

    def test_only_appellant_can_claim_and_duplicate_adjudication_rejected(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_appeal(ledger)
        set_llm(ctx, "low", "high")
        board.adjudicate(SID)
        with ctx.expect_revert("only the bond depositor"):
            ledger.call(OTHER, 0, board.claim_refund, "appeal", SID)
        with ctx.expect_revert("appeal already adjudicated"):
            board.adjudicate(SID)
        assert board.get_appeal(SID)["refund_due"] == BOND
        assert board.get_accounting()["refund_liability"] == BOND


class TestIndependentBondsAndAggregate:
    def test_two_submissions_keep_separate_entitlements(self, ctx, board, ledger):
        evaluated(ctx, board, "a")
        evaluated(ctx, board, "b")
        open_challenge(ledger, "a", CHALLENGER)
        open_challenge(ledger, "b", OTHER)
        set_llm(ctx, "low", "high")
        board.reevaluate("a")
        set_llm(ctx, "elevated")  # unchanged for b -> forfeited
        board.reevaluate("b")
        assert board.get_challenge("a")["refund_due"] == BOND
        assert board.get_challenge("b")["forfeited"] == BOND
        with ctx.expect_revert("only the bond depositor"):
            ledger.call(OTHER, 0, board.claim_refund, "challenge", "a")
        ledger.call(CHALLENGER, 0, board.claim_refund, "challenge", "a")
        assert ledger.bal(CHALLENGER) == 10 * BOND and ledger.bal(OTHER) == 9 * BOND
        assert_ledger_invariants(ledger)


# ───────────────────────── dispute integrity ─────────────────────────

class TestChallengeConflicts:
    def test_valid_initial_challenge(self, ctx, board, ledger):
        evaluated(ctx, board)
        assert open_challenge(ledger) == {"ok": True, "reason": ""}
        assert board.get_dispute_state(SID) == {"active": "challenge", "challenge_count": 1, "appeal_count": 0}

    def test_second_challenge_on_same_unresolved_subject_rejected(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        before = board.get_challenge(SID)
        r = ledger.call(OTHER, BOND, board.challenge, SID, "new_evidence", "z" * 40, "other")
        refused(r, "unresolved challenge already exists")
        assert board.get_challenge(SID) == before  # not overwritten
        assert (OTHER, BOND) in ledger.transfers  # rejected bond returned
        assert ledger.bal(OTHER) == 10 * BOND
        assert ledger.bal(ledger.contract) == BOND
        assert_ledger_invariants(ledger)

    def test_independent_subjects_do_not_conflict(self, ctx, board, ledger):
        evaluated(ctx, board, "a")
        evaluated(ctx, board, "b")
        open_challenge(ledger, "a")
        open_challenge(ledger, "b", OTHER)
        assert board.get_dispute_state("a")["active"] == "challenge"
        assert board.get_dispute_state("b")["active"] == "challenge"

    def test_new_challenge_after_resolution_keeps_history(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        board.reevaluate(SID)  # upheld, forfeited
        first = board.get_challenge(SID, 1)
        open_challenge(ledger, who=OTHER)
        assert board.get_challenge(SID, 1) == first  # history intact
        second = board.get_challenge(SID)  # latest
        assert second["index"] == 2 and second["challenger"].lower() == hexaddr(OTHER)
        assert board.get_dispute_state(SID)["challenge_count"] == 2
        assert_ledger_invariants(ledger)

    def test_challenge_blocked_while_appeal_unresolved(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_appeal(ledger)
        refused(open_challenge(ledger), "unresolved appeal exists")
        assert ledger.bal(CHALLENGER) == 10 * BOND
        with ctx.expect_revert("no challenge"):
            board.get_challenge(SID)

    def test_challenge_needs_verdict(self, ctx, board, ledger):
        with ctx.prank(SUBMITTER):
            board.submit(SID, "Co", "s", "e", [])
        refused(open_challenge(ledger), "no verdict to challenge")
        assert ledger.bal(CHALLENGER) == 10 * BOND
        assert ledger.bal(ledger.contract) == 0


class TestAppealConflicts:
    def test_appeal_blocked_while_challenge_unresolved(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        refused(open_appeal(ledger), "unresolved challenge exists")
        assert ledger.bal(SUBMITTER) == 10 * BOND
        with ctx.expect_revert("no appeal"):
            board.get_appeal(SID)
        assert board.get_dispute_state(SID)["active"] == "challenge"

    def test_second_appeal_rejected_and_first_untouched(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_appeal(ledger)
        before = board.get_appeal(SID)
        refused(ledger.call(SUBMITTER, BOND, board.appeal, SID, "q" * 100), "appeal already filed")
        assert board.get_appeal(SID) == before
        assert ledger.bal(SUBMITTER) == 10 * BOND - BOND  # only the first bond is held

    def test_appeal_only_after_verdict_and_for_known_subject(self, ctx, board, ledger):
        refused(open_appeal(ledger, "ghost"), "unknown submission")
        with ctx.prank(SUBMITTER):
            board.submit(SID, "Co", "s", "e", [])
        refused(open_appeal(ledger), "no verdict to appeal")
        assert ledger.bal(SUBMITTER) == 10 * BOND

    def test_non_submitter_appeal_refused_and_value_returned(self, ctx, board, ledger):
        evaluated(ctx, board)
        refused(open_appeal(ledger, who=OTHER), "only the original submitter")
        assert (OTHER, BOND) in ledger.transfers
        assert ledger.bal(OTHER) == 10 * BOND and ledger.bal(ledger.contract) == 0

    def test_appeal_after_resolved_challenge_allowed(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_challenge(ledger)
        board.reevaluate(SID)
        open_appeal(ledger)
        assert board.get_dispute_state(SID) == {"active": "appeal", "challenge_count": 1, "appeal_count": 1}
        assert board.get_challenge(SID)["resolved"]

    def test_reevaluate_and_adjudicate_cannot_hit_wrong_dispute(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_appeal(ledger)
        with ctx.expect_revert("no active challenge"):
            board.reevaluate(SID)
        evaluated(ctx, board, "other")
        open_challenge(ledger, "other")
        with ctx.expect_revert("no appeal filed"):
            board.adjudicate("other")

    def test_status_returns_to_resolved_and_list_reflects_active_appeal(self, ctx, board, ledger):
        evaluated(ctx, board)
        open_appeal(ledger)
        assert board.list_submissions(0, 10)[0]["status"] == "appealed"
        board.adjudicate(SID)
        assert board.list_submissions(0, 10)[0]["status"] == "resolved"
        assert board.get_dispute_state(SID)["active"] == ""
