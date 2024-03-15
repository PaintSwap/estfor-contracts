// TODO Only needed temporary, can be removed after deployed to live network
import {ethers, upgrades} from "hardhat";
import {
  ITEM_NFT_ADDRESS,
  ITEM_NFT_LIBRARY_ADDRESS,
  ORACLE_ADDRESS,
  PLAYERS_ADDRESS,
  SAMWITCH_VRF_ADDRESS,
} from "./contractAddresses";
import {GenericInstantVRFActionStrategy, InstantVRFActions, VRFRequestInfo} from "../typechain-types";
import {verifyContracts} from "./utils";
import {FeeData} from "@ethersproject/providers";
import {InstantVRFActionType} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying instant VRF actions using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const timeout = 600 * 1000; // 10 minutes

  // TODO: If upgrading OZ can use txOverrides for gas limit
  const FEE_DATA = {
    maxFeePerGas: ethers.utils.parseUnits("100", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("100", "gwei"),
  } as FeeData;

  const provider = new ethers.providers.FallbackProvider([ethers.provider], 1);
  provider.getFeeData = async () => FEE_DATA;

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  signer.estimateGas = async () => {
    return ethers.BigNumber.from(3_600_000);
  };

  const VRFRequestInfo = (await ethers.getContractFactory("VRFRequestInfo")).connect(signer);
  const vrfRequestInfo = (await upgrades.deployProxy(VRFRequestInfo, [], {
    kind: "uups",
    timeout,
  })) as VRFRequestInfo;
  await vrfRequestInfo.deployed();
  console.log(`vrfRequestInfo = "${vrfRequestInfo.address.toLowerCase()}"`);

  const InstantVRFActions = (await ethers.getContractFactory("InstantVRFActions")).connect(signer);
  const instantVRFActions = (await upgrades.deployProxy(
    InstantVRFActions,
    [PLAYERS_ADDRESS, ITEM_NFT_ADDRESS, ORACLE_ADDRESS, SAMWITCH_VRF_ADDRESS, vrfRequestInfo.address],
    {
      kind: "uups",
      timeout,
    }
  )) as InstantVRFActions;
  await instantVRFActions.deployed();
  console.log(`instantVRFActions = "${instantVRFActions.address.toLowerCase()}"`);

  const GenericInstantVRFActionStrategy = await ethers.getContractFactory("GenericInstantVRFActionStrategy");
  const genericInstantVRFActionStrategy = (await upgrades.deployProxy(
    GenericInstantVRFActionStrategy,
    [instantVRFActions.address],
    {
      kind: "uups",
      timeout,
    }
  )) as GenericInstantVRFActionStrategy;
  console.log(`genericInstantVRFActionStrategy = "${genericInstantVRFActionStrategy.address.toLowerCase()}"`);

  // Upgrade ItemNFT
  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: ITEM_NFT_LIBRARY_ADDRESS}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });

  let tx = await itemNFT.setInstantVRFActions(instantVRFActions.address);
  await tx.wait();
  console.log("itemNFT.setInstantVRFActions");

  tx = await instantVRFActions.addStrategies([InstantVRFActionType.FORGING], [genericInstantVRFActionStrategy.address]);
  await tx.wait();
  console.log("instantVRFActions.addStrategies");

  if ((await owner.getChainId()) == 250) {
    await verifyContracts([
      itemNFT.address,
      instantVRFActions.address,
      vrfRequestInfo.address,
      genericInstantVRFActionStrategy.address,
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
