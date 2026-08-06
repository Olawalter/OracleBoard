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

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_ORACLEBOARD_ADDRESS ?? "") as `0x${string}` | "";

export function requireContractAddress(): `0x${string}` {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_ORACLEBOARD_ADDRESS is not set. Deploy the contract with `pnpm deploy:contract` and paste the address into .env.local.",
    );
  }
  return CONTRACT_ADDRESS;
}
