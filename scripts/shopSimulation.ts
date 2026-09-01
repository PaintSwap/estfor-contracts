import {ChildProcess, spawn} from "child_process";
import {createServer} from "net";
import {JsonRpcProvider, toBeHex} from "ethers";
import {verifyShopPostconditions} from "./shopReconciliation";
import type {ShopPlan} from "./shopReconciliation";

export interface ShopSimulationResult {
  status: "passed" | "no-op";
  forkBlock: number;
  calls: Array<{operationId: string; estimatedGas: string; transactionHash: string}>;
  postconditionsVerified: number;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Could not allocate Anvil port"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForAnvil(provider: JsonRpcProvider, child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Anvil exited before simulation started (status ${child.exitCode})`);
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Timed out waiting for the pinned Anvil fork");
}

export async function simulateShopPlan(
  sourceProvider: JsonRpcProvider,
  rpcUrl: string,
  chainId: number,
  forkBlock: number,
  forkBlockHash: string,
  plan: ShopPlan
): Promise<ShopSimulationResult> {
  if (plan.blockedReasons.length !== 0) throw new Error(`Shop simulation blocked: ${plan.blockedReasons.join("; ")}`);
  if (plan.operations.length === 0) {
    return {status: "no-op", forkBlock, calls: [], postconditionsVerified: plan.desired.length};
  }

  const gasEstimates = new Map<string, bigint>();
  for (const operation of plan.operations) {
    const transaction = {
      from: operation.caller,
      to: operation.target,
      data: operation.data,
      value: "0x0",
    };
    const blockTag = toBeHex(forkBlock);
    await sourceProvider.send("eth_call", [transaction, blockTag]);
    gasEstimates.set(operation.id, BigInt(await sourceProvider.send("eth_estimateGas", [transaction, blockTag])));
  }

  const port = await freePort();
  const child = spawn(
    "anvil",
    [
      "--fork-url",
      rpcUrl,
      "--fork-block-number",
      String(forkBlock),
      "--chain-id",
      String(chainId),
      "--port",
      String(port),
      "--silent",
    ],
    {stdio: ["ignore", "ignore", "pipe"]}
  );
  let stderr = "";
  child.stderr?.on("data", (data) => (stderr += String(data)));
  const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, chainId, {staticNetwork: true});
  try {
    await waitForAnvil(provider, child);
    const pinnedBlock = await provider.getBlock(forkBlock);
    if (!pinnedBlock?.hash || pinnedBlock.hash.toLowerCase() !== forkBlockHash.toLowerCase()) {
      throw new Error(`Anvil fork block hash does not match reviewed observation block ${forkBlockHash}`);
    }
    await provider.send("anvil_impersonateAccount", [plan.operations[0].caller]);
    await provider.send("anvil_setBalance", [plan.operations[0].caller, toBeHex(10n ** 18n)]);
    const calls: ShopSimulationResult["calls"] = [];
    for (const operation of plan.operations) {
      operation.estimatedGas = gasEstimates.get(operation.id)!.toString();
      const transactionHash = (await provider.send("eth_sendTransaction", [
        {from: operation.caller, to: operation.target, data: operation.data, value: "0x0"},
      ])) as string;
      const receipt = await provider.waitForTransaction(transactionHash);
      if (!receipt || receipt.status !== 1) throw new Error(`Simulation transaction failed for ${operation.id}`);
      calls.push({
        operationId: operation.id,
        estimatedGas: operation.estimatedGas,
        transactionHash,
      });
    }
    await verifyShopPostconditions(provider, plan);
    return {status: "passed", forkBlock, calls, postconditionsVerified: plan.desired.length};
  } catch (error) {
    if (child.exitCode !== null && stderr.trim()) throw new Error(`Anvil simulation failed: ${stderr.trim()}`);
    throw error;
  } finally {
    provider.destroy();
    child.kill("SIGTERM");
  }
}
