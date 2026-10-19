import { localnet, studionet, testnetAsimov } from "genlayer-js/chains";

export type ChainKey = "studionet" | "testnet-asimov" | "localnet";

const CHAIN_MAP = {
  studionet,
  "testnet-asimov": testnetAsimov,
  localnet,
} as const;

export function resolveChainKey(raw?: string | null): ChainKey {
  const key = (raw ?? "studionet").toLowerCase();
  if (key === "testnet-asimov" || key === "asimov" || key === "testnet") return "testnet-asimov";
  if (key === "localnet" || key === "local") return "localnet";
  return "studionet";
}

export function getChain(key: ChainKey) {
  return CHAIN_MAP[key];
}

export const CLIENT_CHAIN: ChainKey = resolveChainKey(process.env.NEXT_PUBLIC_GENLAYER_CHAIN);

// Latest StudioNet deployment (bond/refund-capable contract). Used when
// NEXT_PUBLIC_ORACLEBOARD_ADDRESS is unset so a fresh clone or hosted build
// works out of the box; the env var always takes precedence. Other chains have
// no default and must set the env var.
export const DEFAULT_STUDIONET_ADDRESS = "0x13e97ade9CAE0C1f8BA875dBE2edB28cFa5EBe2D" as const;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_ORACLEBOARD_ADDRESS ||
  (CLIENT_CHAIN === "studionet" ? DEFAULT_STUDIONET_ADDRESS : "")) as `0x${string}` | "";

export function requireContractAddress(): `0x${string}` {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_ORACLEBOARD_ADDRESS is not set. Deploy the contract with `pnpm deploy:contract` and paste the address into .env.local.",
    );
  }
  return CONTRACT_ADDRESS;
}
