import {ethers, upgrades} from "hardhat";
import {verifyContracts} from "./utils";
import {WFTM_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying non transferrable brush with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const BrushNonTransferrable = await ethers.getContractFactory("BrushNonTransferrable");
  const brushNonTransferrable = await upgrades.deployProxy(BrushNonTransferrable);
  console.log(`Deployed brushNonTransferrable: `, brushNonTransferrable.address);

  let tx = await brushNonTransferrable.mint(owner.address, 10000);
  await tx.wait();
  console.log("Minted le fake brush");

  const uniswapFactory = "0x152ee697f2e276fa89e96742e9bb9ab1f2e61be3";
  const IUniswapV2Factory = await ethers.getContractAt("IUniswapV2Factory", uniswapFactory);

  tx = await IUniswapV2Factory.createPair(brushNonTransferrable.address, WFTM_ADDRESS);
  await tx.wait(3);
  console.log("Created pair");
  const pair = await IUniswapV2Factory.getPair(brushNonTransferrable.address, WFTM_ADDRESS);
  console.log("Pair", pair);

  tx = await brushNonTransferrable.transfer(pair, 10000);
  await tx.wait();
  console.log("Transfered fake brush to pair");

  const wftm = await ethers.getContractAt("IERC20", WFTM_ADDRESS);
  tx = await wftm.transfer(pair, 10000);
  await tx.wait();
  console.log("Transferred wftm to pair");

  const IUniswapV2Pair = await ethers.getContractAt("IUniswapV2Pair", pair);
  tx = await IUniswapV2Pair.mint(owner.address);
  await tx.wait();
  console.log("Minted LP tokens");
  const balance = IUniswapV2Pair.balanceOf(owner.address);
  console.log("BalanceOf", await balance);

  await verifyContracts([brushNonTransferrable.address]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
