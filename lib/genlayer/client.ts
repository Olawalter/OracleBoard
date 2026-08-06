"use client";
import { createClient, createAccount } from "genlayer-js";
import { CLIENT_CHAIN, getChain } from "./config";

const STORAGE_KEY = "oracleboard.account.pk";

function loadOrCreateAccount() {
  if (typeof window === "undefined") return createAccount();
  const cached = window.localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return createAccount(cached as `0x${string}`);
    } catch {
      // fall through, mint a fresh one
    }
  }
  const acc = createAccount();
  try {
    // genlayer-js exposes the private key on the account object
    const pk = (acc as unknown as { privateKey?: string }).privateKey;
    if (pk) window.localStorage.setItem(STORAGE_KEY, pk);
  } catch {
    /* ignore */
  }
  return acc;
}

let _client: ReturnType<typeof createClient> | null = null;
let _account: ReturnType<typeof createAccount> | null = null;
let _initPromise: Promise<void> | null = null;

export function getAccount() {
  if (!_account) _account = loadOrCreateAccount();
  return _account;
}

export function getClient() {
  if (_client) return _client;
  const account = getAccount();
  _client = createClient({ chain: getChain(CLIENT_CHAIN), account });
  return _client;
}

export async function ensureClientReady() {
  if (_initPromise) return _initPromise;
  const client = getClient();
  _initPromise = (async () => {
    try {
      await client.initializeConsensusSmartContract();
    } catch (err) {
      // Studio/localnet sometimes short-circuit; surface for debugging without
      // preventing reads.
      console.warn("initializeConsensusSmartContract:", err);
    }
  })();
  return _initPromise;
}

export function resetAccount() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  _account = null;
  _client = null;
  _initPromise = null;
}
