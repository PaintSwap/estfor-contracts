import {ethers, upgrades} from "hardhat";
import {getChainId, verifyContracts} from "./utils";
import {WFTM_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Deploying non transferrable brush with the account: ${owner.address} on chain id ${await getChainId(owner)}`
  );

  const BrushNonTransferrable = await ethers.getContractFactory("BrushNonTransferrable");
  const brushNonTransferrable = await upgrades.deployProxy(BrushNonTransferrable);
  console.log(`Deployed brushNonTransferrable: `, await brushNonTransferrable.getAddress());

  let tx = await brushNonTransferrable.mint(owner, 10000);
  await tx.wait();
  console.log("Minted le fake brush");

  const uniswapFactory = "0x152ee697f2e276fa89e96742e9bb9ab1f2e61be3";
  const IUniswapV2Factory = await ethers.getContractAt("IUniswapV2Factory", uniswapFactory);

  tx = await IUniswapV2Factory.createPair(brushNonTransferrable, WFTM_ADDRESS);
  await tx.wait(3);
  console.log("Created pair");
  const pair = await IUniswapV2Factory.getPair(brushNonTransferrable, WFTM_ADDRESS);
  console.log("Pair", pair);

  tx = await brushNonTransferrable.transfer(pair, 10000);
  await tx.wait();
  console.log("Transfered fake brush to pair");

  const wftm = await ethers.getContractAt("IERC20", WFTM_ADDRESS);
  tx = await wftm.transfer(pair, 10000);
  await tx.wait();
  console.log("Transferred wftm to pair");

  const IUniswapV2Pair = await ethers.getContractAt("IUniswapV2Pair", pair);
  tx = await IUniswapV2Pair.mint(owner);
  await tx.wait();
  console.log("Minted LP tokens");
  const balance = IUniswapV2Pair.balanceOf(owner);
  console.log("BalanceOf", await balance);

  await verifyContracts([await brushNonTransferrable.getAddress()]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
