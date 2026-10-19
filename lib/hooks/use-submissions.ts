"use client";
import { useCallback, useEffect, useState } from "react";
import { oracleBoard, safeGetAppeal, safeGetChallenge, safeGetDisputeState, safeGetVerdict, type Appeal, type Challenge, type DisputeState, type Submission, type SubmissionRow, type Verdict } from "@/lib/genlayer/oracleboard";

export function useSubmissionList() {
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await oracleBoard.listSubmissions(0, 100);
      setRows(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}

export function useSubmissionBundle(id: string | null) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [disputeState, setDisputeState] = useState<DisputeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, v, c, a, d] = await Promise.all([
        oracleBoard.getSubmission(id),
        safeGetVerdict(id),
        safeGetChallenge(id),
        safeGetAppeal(id),
        safeGetDisputeState(id),
      ]);
      setSubmission(s);
      setVerdict(v);
      setChallenge(c);
      setAppeal(a);
      setDisputeState(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void refresh();
  }, [id, refresh]);

  return { submission, verdict, challenge, appeal, disputeState, loading, error, refresh };
}
