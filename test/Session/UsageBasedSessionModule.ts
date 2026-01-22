import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {GameSubsidisationRegistry, UsageBasedSessionModule, PlayerNFT} from "../../typechain-types";
import {playersFixture} from "../Players/PlayersFixture";

describe("UsageBasedSessionModule", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    return {...baseFixture};
  }

  async function setupSession(groupLimit: number = 2) {
    const {
      gameSubsidisationRegistry,
      usageBasedSessionModule,
      owner,
    }: {
      gameSubsidisationRegistry: GameSubsidisationRegistry;
      usageBasedSessionModule: UsageBasedSessionModule;
      owner: any;
    } = await deployContracts();

    const Safe = await ethers.getContractFactory("TestSessionSafe");
    const safe = (await Safe.deploy(owner.address)) as any;

    const Target = await ethers.getContractFactory("TestSessionTarget");
    const target = (await Target.deploy()) as any;

    const selector = target.interface.getFunction("doAction")!.selector;
    await gameSubsidisationRegistry.setFunctionGroup(await target.getAddress(), selector, 1);
    await gameSubsidisationRegistry.setGroupLimit(1, groupLimit);
    const sessionKey = ethers.Wallet.createRandom();

    await safe.callEnableSession(usageBasedSessionModule, sessionKey.address, 3600);
    const session = await usageBasedSessionModule.getSession(await safe.getAddress());

    return {
      sessionKey,
      safe,
      target,
      selector,
      sessionDeadline: session.deadline,
      module: usageBasedSessionModule,
      gameSubsidisationRegistry,
      owner,
    };
  }

  async function signCall(
    sessionKey: any,
    safe: any,
    target: any,
    data: string,
    nonce: bigint,
    sessionDeadline: bigint,
    moduleAddress: string
  ) {
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "UsageBasedSessionModule",
      version: "1",
      chainId: network.chainId,
      verifyingContract: moduleAddress,
    };
    const types = {
      UsageBasedSession: [
        {name: "safe", type: "address"},
        {name: "target", type: "address"},
        {name: "data", type: "bytes"},
        {name: "nonce", type: "uint256"},
        {name: "sessionDeadline", type: "uint48"},
      ],
    };
    const message = {
      safe: await safe.getAddress(),
      target: await target.getAddress(),
      data,
      nonce,
      sessionDeadline,
    };

    return sessionKey.signTypedData(domain, types, message);
  }

  it("executes an allowed action and consumes daily quota", async () => {
    const {sessionKey, safe, target, module, sessionDeadline} = await setupSession(2);

    const data = target.interface.encodeFunctionData("doAction");
    const signature = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

    await module.execute(await safe.getAddress(), await target.getAddress(), data, signature);

    expect(await target.calls()).to.eq(1);
  });

  describe("enableSession & revokeSession", function () {
    it("fails to enable a session with zero address session key", async () => {
      const {module, safe} = await setupSession(2);
      // Revoke first
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      await expect(
        safe.callEnableSession(await module.getAddress(), ethers.ZeroAddress, 3600)
      ).to.be.revertedWithCustomError(module, "ZeroSessionKey");
    });

    it("fails to enable a session with zero duration", async () => {
      const {module, safe} = await setupSession(2);
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      await expect(
        safe.callEnableSession(await module.getAddress(), ethers.Wallet.createRandom().address, 0)
      ).to.be.revertedWithCustomError(module, "InvalidSessionDuration");
    });

    it("fails to enable a session with duration exceeding max", async () => {
      const {module, safe} = await setupSession(2);
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      const maxDuration = await module.MAX_SESSION_DURATION();
      await expect(
        safe.callEnableSession(await module.getAddress(), ethers.Wallet.createRandom().address, Number(maxDuration) + 1)
      ).to.be.revertedWithCustomError(module, "InvalidSessionDuration");
    });

    it("fails to enable a session if one is already active", async () => {
      const {module, safe} = await setupSession(2);
      await expect(
        safe.callEnableSession(await module.getAddress(), ethers.Wallet.createRandom().address, 3600)
      ).to.be.revertedWithCustomError(module, "ExistingSessionActive");
    });

    it("revokes an active session", async () => {
      const {module, safe} = await setupSession(2);
      const revokeData = module.interface.encodeFunctionData("revokeSession");
      await expect(safe.execTransactionFromModule(await module.getAddress(), 0, revokeData, 0)).to.emit(
        module,
        "SessionRevoked"
      );

      const session = await module.getSession(await safe.getAddress());
      expect(session.sessionKey).to.eq(ethers.ZeroAddress);
    });
  });

  describe("execute requirements", function () {
    it("fails if data is too short", async () => {
      const {module, safe} = await setupSession(2);
      await expect(
        module.execute(await safe.getAddress(), ethers.ZeroAddress, "0x123456", "0x")
      ).to.be.revertedWithCustomError(module, "InvalidCallData");
    });

    it("fails if no session is active", async () => {
      const {module, safe, target, selector} = await setupSession(2);
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      await expect(
        module.execute(await safe.getAddress(), await target.getAddress(), "0x12345678", "0x")
      ).to.be.revertedWithCustomError(module, "NoSessionKey");
    });

    it("fails if session has expired", async () => {
      const {module, safe, target, sessionKey, sessionDeadline} = await setupSession(2);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      const data = target.interface.encodeFunctionData("doAction");
      const signature = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      await expect(
        module.execute(await safe.getAddress(), await target.getAddress(), data, signature)
      ).to.be.revertedWithCustomError(module, "SessionExpired");
    });

    it("fails if action is not permitted (groupId 0)", async () => {
      const {module, safe, target, sessionKey, sessionDeadline, gameSubsidisationRegistry} = await setupSession(2);

      // Use a DIFFERENT target or different selector
      const Target = await ethers.getContractFactory("TestSessionTarget");
      const unmappedTarget = await Target.deploy();

      const data = unmappedTarget.interface.encodeFunctionData("doAction");
      const signature = await signCall(
        sessionKey,
        safe,
        unmappedTarget,
        data,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      await expect(
        module.execute(await safe.getAddress(), await unmappedTarget.getAddress(), data, signature)
      ).to.be.revertedWithCustomError(module, "ActionNotPermitted");
    });

    it("fails if target call reverts", async () => {
      const {module, safe, sessionKey, sessionDeadline, gameSubsidisationRegistry, owner} = await setupSession(2);

      // Deploy a reverting target
      const RevertingTarget = await ethers.getContractFactory("TestSessionRevertingTarget");
      const revertingTarget = await RevertingTarget.deploy();

      const selector = revertingTarget.interface.getFunction("revertAction")!.selector;
      await gameSubsidisationRegistry.setFunctionGroup(await revertingTarget.getAddress(), selector, 1);

      const data = revertingTarget.interface.encodeFunctionData("revertAction");
      const signature = await signCall(
        sessionKey,
        safe,
        revertingTarget,
        data,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      await expect(
        module.execute(await safe.getAddress(), await revertingTarget.getAddress(), data, signature)
      ).to.be.revertedWithCustomError(module, "ModuleCallFailed");
    });

    it("rejects calls signed by the wrong key", async () => {
      const {safe, target, module, sessionDeadline} = await setupSession(2);
      const badSessionKey = ethers.Wallet.createRandom();

      const data = target.interface.encodeFunctionData("doAction");
      const signature = await signCall(
        badSessionKey,
        safe,
        target,
        data,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      await expect(
        module.execute(await safe.getAddress(), await target.getAddress(), data, signature)
      ).to.be.revertedWithCustomError(module, "InvalidSignature");
    });

    it("rejects calls with wrong nonce in signature", async () => {
      const {safe, target, module, sessionDeadline, sessionKey} = await setupSession(2);
      const data = target.interface.encodeFunctionData("doAction");
      // Use nonce 1 instead of 0
      const signature = await signCall(sessionKey, safe, target, data, 1n, sessionDeadline, await module.getAddress());

      await expect(
        module.execute(await safe.getAddress(), await target.getAddress(), data, signature)
      ).to.be.revertedWithCustomError(module, "InvalidSignature");
    });

    it("rejects calls with wrong target in signature", async () => {
      const {safe, target, module, sessionDeadline, sessionKey} = await setupSession(2);
      const data = target.interface.encodeFunctionData("doAction");

      const OtherTarget = await ethers.getContractFactory("TestSessionTarget");
      const otherTarget = await OtherTarget.deploy();

      // Sign for otherTarget but execute for target
      const signature = await signCall(
        sessionKey,
        safe,
        otherTarget,
        data,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      await expect(
        module.execute(await safe.getAddress(), await target.getAddress(), data, signature)
      ).to.be.revertedWithCustomError(module, "InvalidSignature");
    });

    it("enforces group daily limits", async () => {
      const {sessionKey, safe, target, module, sessionDeadline} = await setupSession(2);

      const data = target.interface.encodeFunctionData("doAction");

      const sig0 = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());
      await module.execute(await safe.getAddress(), await target.getAddress(), data, sig0);

      const sig1 = await signCall(sessionKey, safe, target, data, 1n, sessionDeadline, await module.getAddress());
      await module.execute(await safe.getAddress(), await target.getAddress(), data, sig1);

      const sig2 = await signCall(sessionKey, safe, target, data, 2n, sessionDeadline, await module.getAddress());
      await expect(
        module.execute(await safe.getAddress(), await target.getAddress(), data, sig2)
      ).to.be.revertedWithCustomError(module, "GroupLimitReached");
    });
  });

  describe("PlayerNFT integration", function () {
    async function setupPlayerNFTSession(groupLimit: number = 5) {
      const {
        gameSubsidisationRegistry,
        usageBasedSessionModule,
        owner,
        playerNFT,
        avatarId,
      }: {
        gameSubsidisationRegistry: GameSubsidisationRegistry;
        usageBasedSessionModule: UsageBasedSessionModule;
        owner: any;
        playerNFT: PlayerNFT;
        avatarId: number;
      } = await deployContracts();

      const Safe = await ethers.getContractFactory("TestSessionSafe");
      const safe = (await Safe.deploy(owner.address)) as any;

      const selector = playerNFT.interface.getFunction("mint")!.selector;
      await gameSubsidisationRegistry.setFunctionGroup(await playerNFT.getAddress(), selector, 1);
      await gameSubsidisationRegistry.setGroupLimit(1, groupLimit);
      const sessionKey = ethers.Wallet.createRandom();

      await safe.callEnableSession(usageBasedSessionModule, sessionKey.address, 3600);
      const session = await usageBasedSessionModule.getSession(await safe.getAddress());

      return {
        sessionKey,
        safe,
        playerNFT,
        avatarId,
        sessionDeadline: session.deadline,
        module: usageBasedSessionModule,
        gameSubsidisationRegistry,
      };
    }

    it("mints a player NFT via session module", async () => {
      const {sessionKey, safe, playerNFT, avatarId, module, sessionDeadline} = await setupPlayerNFTSession(5);

      const heroName = "SessionHero" + 1;
      const data = playerNFT.interface.encodeFunctionData("mint", [avatarId, heroName, "", "", "", false, true]);
      const signature = await signCall(
        sessionKey,
        safe,
        playerNFT,
        data,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      const tx = await module.execute(await safe.getAddress(), await playerNFT.getAddress(), data, signature);
      const receipt = await tx.wait();

      // Parse NewPlayer event from logs
      const newPlayerLogs = receipt!.logs
        .map((log) => {
          try {
            return playerNFT.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((x) => x && x.name === "NewPlayer");

      expect(newPlayerLogs.length).to.eq(1);
      const parsed = newPlayerLogs[0]!;
      expect(parsed.args?.from).to.eq(await safe.getAddress());
      expect(parsed.args?.avatarId).to.eq(avatarId);
    });

    it("mints multiple players respecting daily limits", async () => {
      const {sessionKey, safe, playerNFT, avatarId, module, sessionDeadline} = await setupPlayerNFTSession(2);

      // First mint
      const data1 = playerNFT.interface.encodeFunctionData("mint", [
        avatarId,
        "FirstHero" + 1,
        "",
        "",
        "",
        false,
        true,
      ]);
      const sig1 = await signCall(sessionKey, safe, playerNFT, data1, 0n, sessionDeadline, await module.getAddress());
      await module.execute(await safe.getAddress(), await playerNFT.getAddress(), data1, sig1);

      // Second mint with different name
      const data2 = playerNFT.interface.encodeFunctionData("mint", [
        avatarId,
        "SecondHero" + 2,
        "",
        "",
        "",
        false,
        true,
      ]);
      const sig2 = await signCall(sessionKey, safe, playerNFT, data2, 1n, sessionDeadline, await module.getAddress());
      await module.execute(await safe.getAddress(), await playerNFT.getAddress(), data2, sig2);

      // Third mint should fail due to group limit
      const data3 = playerNFT.interface.encodeFunctionData("mint", [
        avatarId,
        "ThirdHero" + 3,
        "",
        "",
        "",
        false,
        true,
      ]);
      const sig3 = await signCall(sessionKey, safe, playerNFT, data3, 2n, sessionDeadline, await module.getAddress());
      await expect(
        module.execute(await safe.getAddress(), await playerNFT.getAddress(), data3, sig3)
      ).to.be.revertedWithCustomError(module, "GroupLimitReached");
    });

    it("rejects PlayerNFT mint with invalid session key signature", async () => {
      const {safe, playerNFT, avatarId, module, sessionDeadline} = await setupPlayerNFTSession(5);
      const badSessionKey = ethers.Wallet.createRandom();

      const data = playerNFT.interface.encodeFunctionData("mint", [
        avatarId,
        "BadKeyHero" + Date.now(),
        "",
        "",
        "",
        false,
        true,
      ]);
      const signature = await signCall(
        badSessionKey,
        safe,
        playerNFT,
        data,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      await expect(
        module.execute(await safe.getAddress(), await playerNFT.getAddress(), data, signature)
      ).to.be.revertedWithCustomError(module, "InvalidSignature");
    });
  });
});
