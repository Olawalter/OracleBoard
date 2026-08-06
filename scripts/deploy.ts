/**
 * Deploy the OracleBoard Intelligent Contract to a GenLayer network.
 *
 *   pnpm deploy:contract              # uses NEXT_PUBLIC_GENLAYER_CHAIN
 *   pnpm deploy:contract -- --chain=testnet-asimov
 *
 * Set DEPLOYER_PRIVATE_KEY in .env.local to use a persistent deployer wallet;
 * otherwise a fresh account is minted for the run.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { createAccount, createClient } from "genlayer-js";
import { localnet, studionet, testnetAsimov } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
loadEnv({ path: resolve(ROOT, ".env.local") });
loadEnv({ path: resolve(ROOT, ".env") });

type ChainKey = "studionet" | "testnet-asimov" | "localnet";

function argValue(flag: string) {
  const found = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return found ? found.slice(flag.length + 3) : undefined;
}

function resolveChainKey(raw?: string): ChainKey {
  const key = (raw ?? "").toLowerCase();
  if (key === "testnet-asimov" || key === "asimov" || key === "testnet") return "testnet-asimov";
  if (key === "localnet" || key === "local") return "localnet";
  return "studionet";
}

async function main() {
  const chainKey = resolveChainKey(argValue("chain") ?? process.env.NEXT_PUBLIC_GENLAYER_CHAIN);
  const chain = chainKey === "testnet-asimov" ? testnetAsimov : chainKey === "localnet" ? localnet : studionet;

  const source = readFileSync(resolve(ROOT, "contracts/oracle_board.py"), "utf8");
  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  const account = pk ? createAccount(pk) : createAccount();

  console.log(`▸ Deploying OracleBoard to ${chainKey}`);
  console.log(`  deployer: ${(account as unknown as { address?: string }).address ?? "(unknown)"}`);

  const client = createClient({ chain, account });
  await client.initializeConsensusSmartContract();

  const hash = await client.deployContract({
    code: source,
    args: [],
    leaderOnly: false,
  });
  console.log(`  tx: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 80,
    interval: 3000,
  });

  const address =
    (receipt as unknown as { contract_address?: string }).contract_address ??
    (receipt as unknown as { contractAddress?: string }).contractAddress ??
    (receipt as unknown as { data?: { contract_address?: string } }).data?.contract_address;

  if (!address) {
    console.log("Deployment accepted but no contract address in receipt.");
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(1);
  }
  console.log(`✔ Deployed at ${address}`);

  const envPath = resolve(ROOT, ".env.local");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const withoutAddr = existing
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("NEXT_PUBLIC_ORACLEBOARD_ADDRESS="))
    .join("\n");
  const next =
    (withoutAddr ? withoutAddr.trimEnd() + "\n" : "") +
    `NEXT_PUBLIC_ORACLEBOARD_ADDRESS=${address}\n` +
    `NEXT_PUBLIC_GENLAYER_CHAIN=${chainKey}\n`;
  writeFileSync(envPath, next, "utf8");
  console.log(`✔ Wrote NEXT_PUBLIC_ORACLEBOARD_ADDRESS to .env.local`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
