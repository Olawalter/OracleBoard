"""Direct (in-memory) tests for OracleBoard Intelligent Contract.

Uses glsim to run the contract locally with mocked web/LLM calls.
"""

import json
import re
from pathlib import Path

import pytest
from glsim.engine import VMContext, deploy_contract, create_address

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contracts" / "oracle_board.py"

MOCK_VERDICT = json.dumps({
    "overall_risk": "elevated",
    "confidence": "medium",
    "evidence_coverage": 45,
    "supported_claims": 5,
    "unsupported_claims": 3,
    "contradictions": 1,
    "material_risks": ["regulatory risk", "team concentration"],
    "follow_up": ["verify token distribution", "review audit report"],
    "summary": "Moderate project with governance risks.",
})

SUBMITTER = create_address("submitter")
OTHER_USER = create_address("other_user")

BOND = 1_000_000_000_000_000


@pytest.fixture
def ctx():
    vm = VMContext(_sender=SUBMITTER)
    with vm.activate():
        yield vm


@pytest.fixture
def board(ctx):
    ctx.mock_llm(re.compile(r".*"), MOCK_VERDICT)
    ctx.mock_web(re.compile(r"https://.*"), {"method": "GET", "status": 200, "body": "mocked web page content for testing"})
    return deploy_contract(CONTRACT_PATH, ctx)


def _submit(board, ctx, sid="test-dossier-001", company="TestDAO"):
    with ctx.prank(SUBMITTER):
        board.submit(sid, company, "Evaluate TestDAO", "Evidence text here", ["https://example.com/docs"])


# ──────────────────────────── Submit ────────────────────────────

class TestSubmit:
    def test_creates_submission(self, board, ctx):
        _submit(board, ctx)
        s = board.get_submission("test-dossier-001")
        assert s["company"] == "TestDAO"
        assert s["status"] == "pending"

    def test_appears_in_list(self, board, ctx):
        _submit(board, ctx)
        rows = board.list_submissions(0, 50)
        assert len(rows) == 1
        assert rows[0]["id"] == "test-dossier-001"

    def test_duplicate_id_reverts(self, board, ctx):
        _submit(board, ctx)
        with ctx.expect_revert("submission id already exists"):
            _submit(board, ctx, sid="test-dossier-001")

    def test_empty_id_reverts(self, board, ctx):
        with ctx.expect_revert("bad submission id"):
            with ctx.prank(SUBMITTER):
                board.submit("", "Company", "summary", "evidence", [])

    def test_too_long_id_reverts(self, board, ctx):
        with ctx.expect_revert("bad submission id"):
            with ctx.prank(SUBMITTER):
                board.submit("x" * 81, "Company", "summary", "evidence", [])

    def test_empty_company_reverts(self, board, ctx):
        with ctx.expect_revert("company required"):
            with ctx.prank(SUBMITTER):
                board.submit("id-1", "", "summary", "evidence", [])

    def test_too_many_urls_reverts(self, board, ctx):
        with ctx.expect_revert("too many urls"):
            with ctx.prank(SUBMITTER):
                board.submit("id-1", "Co", "s", "e", ["https://a.com"] * 9)

    def test_non_https_url_reverts(self, board, ctx):
        with ctx.expect_revert("only https URLs are allowed"):
            with ctx.prank(SUBMITTER):
                board.submit("id-1", "Co", "s", "e", ["http://insecure.com"])

    def test_blocked_host_reverts(self, board, ctx):
        with ctx.expect_revert("blocked host"):
            with ctx.prank(SUBMITTER):
                board.submit("id-1", "Co", "s", "e", ["https://localhost/api"])


# ──────────────────────────── Evaluate ────────────────────────────

class TestEvaluate:
    def test_stores_verdict(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        v = board.get_verdict("test-dossier-001")
        assert v["overall_risk"] == "elevated"
        assert v["confidence"] == "medium"
        assert v["evidence_coverage"] == 45
        assert v["supported_claims"] == 5
        assert v["unsupported_claims"] == 3
        assert v["contradictions"] == 1
        assert len(v["material_risks"]) == 2
        assert len(v["follow_up"]) == 2

    def test_sets_status_resolved(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        s = board.get_submission("test-dossier-001")
        assert s["status"] == "resolved"

    def test_unknown_submission_reverts(self, board, ctx):
        with ctx.expect_revert("unknown submission"):
            board.evaluate("nonexistent")

    def test_already_evaluated_reverts(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        with ctx.expect_revert("already evaluated"):
            board.evaluate("test-dossier-001")


# ──────────────────────────── Challenge ────────────────────────────

class TestChallenge:
    def test_requires_verdict(self, board, ctx):
        _submit(board, ctx)
        r = board.challenge("test-dossier-001", "new_evidence", "x" * 40, "reason")
        assert not r["ok"] and r["reason"] == "no verdict to challenge"

    def test_new_evidence_requires_substance(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        r = board.challenge("test-dossier-001", "new_evidence", "short", "reason")
        assert not r["ok"] and "requires substantive evidence" in r["reason"]

    def test_factual_error_requires_reason(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        r = board.challenge("test-dossier-001", "factual_error", "evidence", "short")
        assert not r["ok"] and "requires a substantive reason" in r["reason"]

    def test_sets_status_challenged(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        board.challenge("test-dossier-001", "new_evidence", "x" * 40, "reason text")
        ctx.value = 0
        s = board.get_submission("test-dossier-001")
        assert s["status"] == "challenged"
        c = board.get_challenge("test-dossier-001")
        assert c["kind"] == "new_evidence"
        assert not c["resolved"]


# ──────────────────────────── Reevaluate ────────────────────────────

class TestReevaluate:
    def test_requires_challenge(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        with ctx.expect_revert("no active challenge"):
            board.reevaluate("test-dossier-001")

    def test_resolves_challenge(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        board.challenge("test-dossier-001", "new_evidence", "x" * 40, "reason text")
        ctx.value = 0
        board.reevaluate("test-dossier-001")
        c = board.get_challenge("test-dossier-001")
        assert c["resolved"]
        s = board.get_submission("test-dossier-001")
        assert s["status"] == "resolved"


# ──────────────────────────── Appeal ────────────────────────────

class TestAppeal:
    def test_requires_verdict(self, board, ctx):
        _submit(board, ctx)
        ctx.value = BOND
        with ctx.prank(SUBMITTER):
            r = board.appeal("test-dossier-001", "x" * 100)
        assert not r["ok"] and r["reason"] == "no verdict to appeal"
        ctx.value = 0

    def test_requires_submitter(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        with ctx.prank(OTHER_USER):
            r = board.appeal("test-dossier-001", "x" * 100)
        assert not r["ok"] and r["reason"] == "only the original submitter can appeal"
        ctx.value = 0

    def test_requires_bond(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = 0
        with ctx.prank(SUBMITTER):
            r = board.appeal("test-dossier-001", "x" * 100)
        assert not r["ok"] and "appeal requires a bond" in r["reason"]

    def test_requires_min_rebuttal(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        with ctx.prank(SUBMITTER):
            r = board.appeal("test-dossier-001", "too short")
        assert not r["ok"] and r["reason"] == "rebuttal must be at least 64 characters"
        ctx.value = 0

    def test_sets_status_appealed(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        with ctx.prank(SUBMITTER):
            board.appeal("test-dossier-001", "x" * 100)
        ctx.value = 0
        s = board.get_submission("test-dossier-001")
        assert s["status"] == "appealed"
        a = board.get_appeal("test-dossier-001")
        assert a["bond_wei"] == BOND
        assert not a["adjudicated"]
        assert not a["overturned"]

    def test_duplicate_reverts(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        with ctx.prank(SUBMITTER):
            board.appeal("test-dossier-001", "x" * 100)
        with ctx.prank(SUBMITTER):
            r = board.appeal("test-dossier-001", "y" * 100)
        assert not r["ok"] and r["reason"] == "appeal already filed"
        ctx.value = 0

    def test_shows_in_list(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        with ctx.prank(SUBMITTER):
            board.appeal("test-dossier-001", "x" * 100)
        ctx.value = 0
        rows = board.list_submissions(0, 50)
        assert rows[0]["status"] == "appealed"


# ──────────────────────────── Adjudicate ────────────────────────────

class TestAdjudicate:
    def test_requires_appeal(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        with ctx.expect_revert("no appeal filed"):
            board.adjudicate("test-dossier-001")

    def test_marks_adjudicated(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        with ctx.prank(SUBMITTER):
            board.appeal("test-dossier-001", "x" * 100)
        ctx.value = 0
        board.adjudicate("test-dossier-001")
        a = board.get_appeal("test-dossier-001")
        assert a["adjudicated"]
        s = board.get_submission("test-dossier-001")
        assert s["status"] == "resolved"

    def test_already_adjudicated_reverts(self, board, ctx):
        _submit(board, ctx)
        board.evaluate("test-dossier-001")
        ctx.value = BOND
        with ctx.prank(SUBMITTER):
            board.appeal("test-dossier-001", "x" * 100)
        ctx.value = 0
        board.adjudicate("test-dossier-001")
        with ctx.expect_revert("appeal already adjudicated"):
            board.adjudicate("test-dossier-001")


# ──────────────────────────── Views ────────────────────────────

class TestViews:
    def test_get_submission_unknown_reverts(self, board, ctx):
        with ctx.expect_revert("unknown submission"):
            board.get_submission("nope")

    def test_get_verdict_no_verdict_reverts(self, board, ctx):
        _submit(board, ctx)
        with ctx.expect_revert("no verdict yet"):
            board.get_verdict("test-dossier-001")

    def test_get_challenge_no_challenge_reverts(self, board, ctx):
        _submit(board, ctx)
        with ctx.expect_revert("no challenge"):
            board.get_challenge("test-dossier-001")

    def test_get_appeal_no_appeal_reverts(self, board, ctx):
        _submit(board, ctx)
        with ctx.expect_revert("no appeal"):
            board.get_appeal("test-dossier-001")

    def test_list_submissions_empty(self, board, ctx):
        rows = board.list_submissions(0, 50)
        assert rows == []

    def test_list_submissions_pagination(self, board, ctx):
        for i in range(5):
            with ctx.prank(SUBMITTER):
                board.submit(f"sub-{i}", f"Company {i}", "", "evidence", [])
        page = board.list_submissions(2, 2)
        assert len(page) == 2
        assert page[0]["id"] == "sub-2"


# ──────────────────────────── Consensus signature ────────────────────────────

class TestConsensusSignature:
    def test_same_verdict_same_signature(self, board, ctx):
        _submit(board, ctx, sid="sig-1")
        _submit(board, ctx, sid="sig-2")
        board.evaluate("sig-1")
        board.evaluate("sig-2")
        v1 = board.get_verdict("sig-1")
        v2 = board.get_verdict("sig-2")
        assert v1["overall_risk"] == v2["overall_risk"]
        assert v1["confidence"] == v2["confidence"]
        assert v1["evidence_coverage"] == v2["evidence_coverage"]
