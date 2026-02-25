import {loadFixture, setNextBlockBaseFeePerGas} from "@nomicfoundation/hardhat-network-helpers";
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

    await usageBasedSessionModule.setWhitelistedSigner([owner.address], true);
    await owner.sendTransaction({to: await usageBasedSessionModule.getAddress(), value: ethers.parseEther("1")});

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

    await module.executeBatch([{safe: await safe.getAddress(), target: await target.getAddress(), data, signature}]);

    expect(await target.calls()).to.eq(1);
  });

  describe("enableSession & revokeSession", function () {
    it("fails to enable a session with zero address session key", async () => {
      const {module, safe} = await setupSession(2);
      // ZeroSessionKey is checked before ExistingSessionActive / SessionOpsPerDayLimitReached
      await expect(
        safe.callEnableSession(await module.getAddress(), ethers.ZeroAddress, 3600)
      ).to.be.revertedWithCustomError(module, "ZeroSessionKey");
    });

    it("fails to enable a session with zero duration", async () => {
      const {module, safe} = await setupSession(2);
      // InvalidSessionDuration is checked before ExistingSessionActive / SessionOpsPerDayLimitReached
      await expect(
        safe.callEnableSession(await module.getAddress(), ethers.Wallet.createRandom().address, 0)
      ).to.be.revertedWithCustomError(module, "InvalidSessionDuration");
    });

    it("fails to enable a session with duration exceeding max", async () => {
      const {module, safe} = await setupSession(2);
      // InvalidSessionDuration is checked before ExistingSessionActive / SessionOpsPerDayLimitReached
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
      // No time advance needed — daily op limit allows this revoke
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
      const {module, safe, sessionKey, target, sessionDeadline} = await setupSession(2);
      const data = "0x123456";
      const validData = target.interface.encodeFunctionData("doAction");
      const goodSig = await signCall(
        sessionKey,
        safe,
        target,
        validData,
        0n,
        sessionDeadline,
        await module.getAddress()
      );
      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: ethers.ZeroAddress, data, signature: "0x"},
        {safe: await safe.getAddress(), target: await target.getAddress(), data: validData, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), "0x00000000", module.interface.encodeErrorResult("InvalidCallData", []));
    });

    it("fails if no session is active", async () => {
      const {module, safe, target, sessionKey, owner} = await setupSession(2);
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      // Create a second safe with an active session to provide the required passing item
      const Safe2 = await ethers.getContractFactory("TestSessionSafe");
      const safe2 = (await Safe2.deploy(owner.address)) as any;
      const sessionKey2 = ethers.Wallet.createRandom();
      await safe2.callEnableSession(module, sessionKey2.address, 3600);
      const session2 = await module.getSession(await safe2.getAddress());
      const validData = target.interface.encodeFunctionData("doAction");
      const goodSig = await signCall(
        sessionKey2,
        safe2,
        target,
        validData,
        0n,
        session2.deadline,
        await module.getAddress()
      );

      const data = "0x12345678";
      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: "0x"},
        {safe: await safe2.getAddress(), target: await target.getAddress(), data: validData, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), "0x12345678", module.interface.encodeErrorResult("NoSessionKey", []));
    });

    it("fails if session has expired", async () => {
      const {module, safe, target, sessionKey, sessionDeadline, selector, owner} = await setupSession(2);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // Create a second safe with a new session after the time advance to provide the required passing item
      const Safe2 = await ethers.getContractFactory("TestSessionSafe");
      const safe2 = (await Safe2.deploy(owner.address)) as any;
      const sessionKey2 = ethers.Wallet.createRandom();
      await safe2.callEnableSession(module, sessionKey2.address, 3600);
      const session2 = await module.getSession(await safe2.getAddress());
      const validData = target.interface.encodeFunctionData("doAction");
      const goodSig = await signCall(
        sessionKey2,
        safe2,
        target,
        validData,
        0n,
        session2.deadline,
        await module.getAddress()
      );

      const data = target.interface.encodeFunctionData("doAction");
      const signature = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature},
        {safe: await safe2.getAddress(), target: await target.getAddress(), data: validData, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), selector, module.interface.encodeErrorResult("SessionExpired", []));
    });

    it("fails if action is not permitted (groupId 0)", async () => {
      const {module, safe, sessionKey, sessionDeadline, target} = await setupSession(2);

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

      const validData = target.interface.encodeFunctionData("doAction");
      const goodSig = await signCall(
        sessionKey,
        safe,
        target,
        validData,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await unmappedTarget.getAddress(), data, signature},
        {safe: await safe.getAddress(), target: await target.getAddress(), data: validData, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(
          await safe.getAddress(),
          unmappedTarget.interface.getFunction("doAction")!.selector,
          module.interface.encodeErrorResult("ActionNotPermitted", [])
        );
    });

    it("fails if target call reverts", async () => {
      const {module, safe, sessionKey, sessionDeadline, gameSubsidisationRegistry, target} = await setupSession(2);

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

      const validData = target.interface.encodeFunctionData("doAction");
      const goodSig = await signCall(
        sessionKey,
        safe,
        target,
        validData,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await revertingTarget.getAddress(), data, signature},
        {safe: await safe.getAddress(), target: await target.getAddress(), data: validData, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), selector, module.interface.encodeErrorResult("ModuleCallFailed", []));
    });

    it("rejects calls signed by the wrong key", async () => {
      const {safe, target, module, sessionDeadline, selector, sessionKey} = await setupSession(2);
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

      const goodSig = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature},
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), selector, module.interface.encodeErrorResult("InvalidSignature", []));
    });

    it("rejects calls with wrong nonce in signature", async () => {
      const {safe, target, module, sessionDeadline, sessionKey, selector} = await setupSession(2);
      const data = target.interface.encodeFunctionData("doAction");
      // Use nonce 1 instead of 0
      const signature = await signCall(sessionKey, safe, target, data, 1n, sessionDeadline, await module.getAddress());
      const goodSig = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature},
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), selector, module.interface.encodeErrorResult("InvalidSignature", []));
    });

    it("rejects calls with wrong target in signature", async () => {
      const {safe, target, module, sessionDeadline, sessionKey, selector} = await setupSession(2);
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

      const goodSig = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature},
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), selector, module.interface.encodeErrorResult("InvalidSignature", []));
    });

    it("enforces group daily limits", async () => {
      const {sessionKey, safe, target, module, sessionDeadline, selector, owner} = await setupSession(2);

      const data = target.interface.encodeFunctionData("doAction");

      const sig0 = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());
      await module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: sig0},
      ]);

      const sig1 = await signCall(sessionKey, safe, target, data, 1n, sessionDeadline, await module.getAddress());
      await module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: sig1},
      ]);

      // Set up a second safe with a fresh session to provide the required passing item
      const Safe2 = await ethers.getContractFactory("TestSessionSafe");
      const safe2 = (await Safe2.deploy(owner.address)) as any;
      const sessionKey2 = ethers.Wallet.createRandom();
      await safe2.callEnableSession(module, sessionKey2.address, 3600);
      const session2 = await module.getSession(await safe2.getAddress());
      const goodSig = await signCall(
        sessionKey2,
        safe2,
        target,
        data,
        0n,
        session2.deadline,
        await module.getAddress()
      );

      const sig2 = await signCall(sessionKey, safe, target, data, 2n, sessionDeadline, await module.getAddress());
      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: sig2},
        {safe: await safe2.getAddress(), target: await target.getAddress(), data, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), selector, module.interface.encodeErrorResult("GroupLimitReached", []));
    });

    it("executes a batch with mixed success and failure (same safe)", async () => {
      const {sessionKey, safe, target, module, sessionDeadline, gameSubsidisationRegistry, selector} =
        await setupSession(5);

      // Setup a reverting target
      const RevertingTarget = await ethers.getContractFactory("TestSessionRevertingTarget");
      const revertingTarget = await RevertingTarget.deploy();
      const revertSelector = revertingTarget.interface.getFunction("revertAction")!.selector;
      await gameSubsidisationRegistry.setFunctionGroup(await revertingTarget.getAddress(), revertSelector, 1);

      const dataSuccess = target.interface.encodeFunctionData("doAction");
      const sig0 = await signCall(
        sessionKey,
        safe,
        target,
        dataSuccess,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      const dataFail = revertingTarget.interface.encodeFunctionData("revertAction");
      const sig1 = await signCall(
        sessionKey,
        safe,
        revertingTarget,
        dataFail,
        1n,
        sessionDeadline,
        await module.getAddress()
      );

      // Use nonce 1n again because sig1 will fail and revert state
      const sig2 = await signCall(
        sessionKey,
        safe,
        target,
        dataSuccess,
        1n,
        sessionDeadline,
        await module.getAddress()
      );

      const params = [
        {safe: await safe.getAddress(), target: await target.getAddress(), data: dataSuccess, signature: sig0},
        {safe: await safe.getAddress(), target: await revertingTarget.getAddress(), data: dataFail, signature: sig1},
        {safe: await safe.getAddress(), target: await target.getAddress(), data: dataSuccess, signature: sig2},
      ];

      const tx = await module.executeBatch(params);

      // Verify successes
      expect(await target.calls()).to.eq(2);

      // Verify failure event
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), revertSelector, module.interface.encodeErrorResult("ModuleCallFailed", []));

      // Verify nonces incremented (total 2 successful increments)
      await expect(tx)
        .to.emit(module, "SessionNonceIncremented")
        .withArgs(await safe.getAddress(), 1n);
      await expect(tx)
        .to.emit(module, "SessionNonceIncremented")
        .withArgs(await safe.getAddress(), 2n);
    });

    it("executes a batch with mixed success and failure (different safes)", async () => {
      const setup1 = await setupSession(5);
      const {module, gameSubsidisationRegistry, owner} = setup1;

      // Setup safe2
      const Safe = await ethers.getContractFactory("TestSessionSafe");
      const safe2 = (await Safe.deploy(owner.address)) as any;
      const Target = await ethers.getContractFactory("TestSessionTarget");
      const target2 = (await Target.deploy()) as any;
      const selector2 = target2.interface.getFunction("doAction")!.selector;
      await gameSubsidisationRegistry.setFunctionGroup(await target2.getAddress(), selector2, 1);
      const sessionKey2 = ethers.Wallet.createRandom();
      await safe2.callEnableSession(module, sessionKey2.address, 3600);
      const session2 = await module.getSession(await safe2.getAddress());

      const data1 = setup1.target.interface.encodeFunctionData("doAction");
      const data2 = target2.interface.encodeFunctionData("doAction");

      // Success for safe1
      const sig1 = await signCall(
        setup1.sessionKey,
        setup1.safe,
        setup1.target,
        data1,
        0n,
        setup1.sessionDeadline,
        await module.getAddress()
      );

      // Failure for safe2 (using wrong nonce)
      const sig2 = await signCall(
        sessionKey2,
        safe2,
        target2,
        data2,
        999n, // Wrong nonce
        session2.deadline,
        await module.getAddress()
      );

      const params = [
        {safe: await setup1.safe.getAddress(), target: await setup1.target.getAddress(), data: data1, signature: sig1},
        {safe: await safe2.getAddress(), target: await target2.getAddress(), data: data2, signature: sig2},
      ];

      const tx = await module.executeBatch(params);

      // Verify safe1 succeeded
      expect(await setup1.target.calls()).to.eq(1);
      // Verify safe2 failed
      expect(await target2.calls()).to.eq(0);

      // Verify failure event for safe2
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe2.getAddress(), selector2, module.interface.encodeErrorResult("InvalidSignature", []));

      // Verify success for safe1
      await expect(tx)
        .to.emit(module, "SessionNonceIncremented")
        .withArgs(await setup1.safe.getAddress(), 1n);
    });

    it("handles duplicate items in a single batch (replay protection)", async () => {
      const {sessionKey, safe, target, module, sessionDeadline, selector} = await setupSession(5);
      const data = target.interface.encodeFunctionData("doAction");
      const signature = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      const params = [
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature},
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature},
      ];

      const tx = await module.executeBatch(params);

      // First item succeeds
      expect(await target.calls()).to.eq(1);
      // Second item fails because nonce was already incremented during the first item's execution
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(await safe.getAddress(), selector, module.interface.encodeErrorResult("InvalidSignature", []));
    });

    it("handles empty batch arrays", async () => {
      const {module} = await setupSession(2);
      await expect(module.executeBatch([])).to.be.revertedWithCustomError(module, "NoBatchItems");
    });

    it("enforces separate daily limits for different groups in the same batch", async () => {
      const {sessionKey, safe, target, module, sessionDeadline, gameSubsidisationRegistry, owner} = await setupSession(
        1
      );

      const groupId1 = 1n;
      const groupId2 = 2n;
      const limit = 1n;

      // Set limit of 1 for both groups
      await gameSubsidisationRegistry.setGroupLimit(groupId1, limit);
      await gameSubsidisationRegistry.setGroupLimit(groupId2, limit);

      const selector = target.interface.getFunction("doAction").selector;
      await gameSubsidisationRegistry.setFunctionGroup(await target.getAddress(), selector, groupId1);
      const data = target.interface.encodeFunctionData("doAction");
      const sig1 = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      // Submit first call (consumes group 1 quota)
      await module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: sig1},
      ]);
      expect(await target.calls()).to.eq(1);

      // Now change function to groupId2 and submit again for same safe
      await gameSubsidisationRegistry.setFunctionGroup(await target.getAddress(), selector, groupId2);
      const sig2 = await signCall(sessionKey, safe, target, data, 1n, sessionDeadline, await module.getAddress());

      const tx = await module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: sig2},
      ]);
      await expect(tx).to.not.emit(module, "BatchItemFailed");
      expect(await target.calls()).to.eq(2);

      // Set up a second safe with a second target (in group 1) to provide the required passing item for tx2
      const Safe2 = await ethers.getContractFactory("TestSessionSafe");
      const safe2 = (await Safe2.deploy(owner.address)) as any;
      const sessionKey2 = ethers.Wallet.createRandom();
      await safe2.callEnableSession(module, sessionKey2.address, 3600);
      const session2 = await module.getSession(await safe2.getAddress());
      const Target2 = await ethers.getContractFactory("TestSessionTarget");
      const target2 = (await Target2.deploy()) as any;
      await gameSubsidisationRegistry.setFunctionGroup(await target2.getAddress(), selector, groupId1);
      const goodSig = await signCall(
        sessionKey2,
        safe2,
        target2,
        data,
        0n,
        session2.deadline,
        await module.getAddress()
      );

      // Group 3 (unset, defaults to 0) should fail because group 0 has no limit/quota initialized or exceeds 0
      const sig3 = await signCall(sessionKey, safe, target, data, 2n, sessionDeadline, await module.getAddress());
      await gameSubsidisationRegistry.setFunctionGroup(await target.getAddress(), selector, 0n);
      const tx2 = await module.executeBatch([
        {safe: await safe.getAddress(), target: await target.getAddress(), data, signature: sig3},
        {safe: await safe2.getAddress(), target: await target2.getAddress(), data, signature: goodSig},
      ]);
      await expect(tx2).to.emit(module, "BatchItemFailed");
    });

    it("fails if signer is not whitelisted", async () => {
      const {sessionKey, safe, target, module, sessionDeadline} = await setupSession(2);
      const [, other] = await ethers.getSigners();

      const data = target.interface.encodeFunctionData("doAction");
      const signature = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      // Attempt to execute with 'other' (not whitelisted)
      await expect(
        module
          .connect(other)
          .executeBatch([{safe: await safe.getAddress(), target: await target.getAddress(), data, signature}])
      ).to.be.revertedWithCustomError(module, "UnauthorizedSigner");
    });

    it("refunds gas to the whitelisted signer", async () => {
      const {sessionKey, safe, target, module, sessionDeadline} = await setupSession(2);
      const [, otherWhitelisted] = await ethers.getSigners();

      await module.setWhitelistedSigner([otherWhitelisted.address], true);

      const data = target.interface.encodeFunctionData("doAction");
      const signature = await signCall(sessionKey, safe, target, data, 0n, sessionDeadline, await module.getAddress());

      const gasPrice = ethers.parseUnits("20", "gwei");
      // set network gas price
      await setNextBlockBaseFeePerGas(gasPrice);

      const balanceBefore = await ethers.provider.getBalance(otherWhitelisted.address);
      const tx = await module
        .connect(otherWhitelisted)
        .executeBatch([{safe: await safe.getAddress(), target: await target.getAddress(), data, signature}], {
          gasPrice,
        });
      const receipt = await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(otherWhitelisted.address);

      // balanceAfter = balanceBefore - gasUsedInTx + refund
      // There's still a tiny cost because gasUsedInTx > gasUsedInModule (some overhead not covered)
      // but it should be very close.

      expect(balanceAfter).to.be.closeTo(balanceBefore, ethers.parseEther("0.001"));
      expect(balanceAfter).to.be.gte(balanceBefore - receipt!.gasUsed * receipt!.gasPrice);
    });
  });

  describe("Session operation daily limit", function () {
    it("revokeSession reverts with SessionOpsPerDayLimitReached after exhausting daily limit", async () => {
      const {usageBasedSessionModule, owner, gameSubsidisationRegistry} = await deployContracts();
      const module = usageBasedSessionModule;
      // Set limit to 1 op per day so the single enableSession in setup exhausts it
      await module.setSessionOpsPerDay(1);

      const Safe = await ethers.getContractFactory("TestSessionSafe");
      const safe = (await Safe.deploy(owner.address)) as any;
      const Target = await ethers.getContractFactory("TestSessionTarget");
      const target = await Target.deploy();
      const sel = target.interface.getFunction("doAction")!.selector;
      await gameSubsidisationRegistry.setFunctionGroup(await target.getAddress(), sel, 1);
      await gameSubsidisationRegistry.setGroupLimit(1, 5);
      await module.setWhitelistedSigner([owner.address], true);
      await owner.sendTransaction({to: await module.getAddress(), value: ethers.parseEther("1")});

      // enableSession consumes the 1 allowed op
      await safe.callEnableSession(module, ethers.Wallet.createRandom().address, 3600);

      // revokeSession should now revert — daily limit exhausted
      await expect(safe.callRevokeSession(module)).to.be.revertedWithCustomError(
        module,
        "SessionOpsPerDayLimitReached"
      );
    });

    it("revokeSession succeeds within daily limit", async () => {
      const {module, safe} = await setupSession(2); // default 5 ops/day — enable used 1
      const revokeData = module.interface.encodeFunctionData("revokeSession");
      await expect(safe.execTransactionFromModule(await module.getAddress(), 0, revokeData, 0)).to.emit(
        module,
        "SessionRevoked"
      );

      const session = await module.getSession(await safe.getAddress());
      expect(session.sessionKey).to.eq(ethers.ZeroAddress);
    });

    it("enableSession reverts with SessionOpsPerDayLimitReached after exhausting daily ops", async () => {
      const {module, safe} = await setupSession(2); // default 5 ops/day — enable used op 1

      // Revoke (op 2)
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      // Re-enable (op 3)
      const newKey1 = ethers.Wallet.createRandom();
      await safe.callEnableSession(await module.getAddress(), newKey1.address, 3600);

      // Revoke (op 4)
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      // Re-enable (op 5 — uses last allowed op)
      const newKey2 = ethers.Wallet.createRandom();
      await safe.callEnableSession(await module.getAddress(), newKey2.address, 3600);

      // Revoke again would need op 6 — should fail
      await expect(safe.callRevokeSession(module)).to.be.revertedWithCustomError(
        module,
        "SessionOpsPerDayLimitReached"
      );
    });

    it("enableSession reverts with SessionOpsPerDayLimitReached when daily limit exhausted", async () => {
      const {usageBasedSessionModule, owner, gameSubsidisationRegistry} = await deployContracts();
      const module = usageBasedSessionModule;
      await module.setSessionOpsPerDay(2); // 2 ops/day

      const Safe = await ethers.getContractFactory("TestSessionSafe");
      const safe = (await Safe.deploy(owner.address)) as any;
      const Target = await ethers.getContractFactory("TestSessionTarget");
      const target = await Target.deploy();
      const sel = target.interface.getFunction("doAction")!.selector;
      await gameSubsidisationRegistry.setFunctionGroup(await target.getAddress(), sel, 1);
      await module.setWhitelistedSigner([owner.address], true);
      await owner.sendTransaction({to: await module.getAddress(), value: ethers.parseEther("1")});

      // Enable (op 1)
      await safe.callEnableSession(module, ethers.Wallet.createRandom().address, 3600);

      // Revoke (op 2 — exhausts limit)
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      // Enable again should fail — limit of 2 reached
      await expect(
        safe.callEnableSession(module, ethers.Wallet.createRandom().address, 3600)
      ).to.be.revertedWithCustomError(module, "SessionOpsPerDayLimitReached");
    });

    it("enableSession succeeds on a new day after exhausting previous day's limit", async () => {
      const {usageBasedSessionModule, owner, gameSubsidisationRegistry} = await deployContracts();
      const module = usageBasedSessionModule;
      await module.setSessionOpsPerDay(2); // 2 ops/day

      const Safe = await ethers.getContractFactory("TestSessionSafe");
      const safe = (await Safe.deploy(owner.address)) as any;
      const Target = await ethers.getContractFactory("TestSessionTarget");
      const target = await Target.deploy();
      const sel = target.interface.getFunction("doAction")!.selector;
      await gameSubsidisationRegistry.setFunctionGroup(await target.getAddress(), sel, 1);
      await module.setWhitelistedSigner([owner.address], true);
      await owner.sendTransaction({to: await module.getAddress(), value: ethers.parseEther("1")});

      // Exhaust today's 2 ops: enable (op 1) + revoke (op 2)
      await safe.callEnableSession(module, ethers.Wallet.createRandom().address, 86400 * 2); // 2-day session
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      // Further ops blocked today
      await expect(
        safe.callEnableSession(module, ethers.Wallet.createRandom().address, 3600)
      ).to.be.revertedWithCustomError(module, "SessionOpsPerDayLimitReached");

      // Advance to the next day
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);

      // Should succeed on new day
      const newKey = ethers.Wallet.createRandom();
      await expect(safe.callEnableSession(module, newKey.address, 3600)).to.emit(module, "SessionEnabled");
      const session = await module.getSession(await safe.getAddress());
      expect(session.sessionKey).to.eq(newKey.address);
    });

    it("opDay and opCount are preserved after revokeSession", async () => {
      const {module, safe} = await setupSession(2); // default 5 ops/day — enable used op 1

      // Revoke (op 2)
      await safe.execTransactionFromModule(
        await module.getAddress(),
        0,
        module.interface.encodeFunctionData("revokeSession"),
        0
      );

      // Session is deleted but opDay/opCount must be preserved
      const session = await module.getSession(await safe.getAddress());
      expect(session.sessionKey).to.eq(ethers.ZeroAddress);
      expect(session.opDay).to.be.gt(0n);
      expect(session.opCount).to.eq(2n);

      // Immediately re-enabling must succeed (op 3 is still within the 5-op limit)
      const newKey = ethers.Wallet.createRandom();
      await expect(safe.callEnableSession(await module.getAddress(), newKey.address, 3600)).to.emit(
        module,
        "SessionEnabled"
      );
    });

    it("owner can update sessionOpsPerDay", async () => {
      const {module} = await setupSession(2);
      const newLimit = 5;
      await expect(module.setSessionOpsPerDay(newLimit)).to.emit(module, "SessionOpsPerDayUpdated").withArgs(newLimit);
      expect(await module.getSessionOpsPerDay()).to.eq(newLimit);
    });

    it("non-owner cannot update sessionOpsPerDay", async () => {
      const {module} = await setupSession(2);
      const [, other] = await ethers.getSigners();
      await expect(module.connect(other).setSessionOpsPerDay(5)).to.be.revertedWithCustomError(
        module,
        "OwnableUnauthorizedAccount"
      );
    });

    it("setSessionOpsPerDay reverts if zero", async () => {
      const {module} = await setupSession(2);
      await expect(module.setSessionOpsPerDay(0)).to.be.revertedWithCustomError(module, "InvalidSessionDuration");
    });

    it("getSessionOpsPerDay returns the configured value", async () => {
      const {module} = await setupSession(2);
      expect(await module.getSessionOpsPerDay()).to.eq(5n); // default 5
      await module.setSessionOpsPerDay(3);
      expect(await module.getSessionOpsPerDay()).to.eq(3n);
    });
  });

  describe("Whitelisting", function () {
    it("allows owner to whitelist signers", async () => {
      const {module} = await setupSession(2);
      const [, other] = await ethers.getSigners();

      await expect(module.setWhitelistedSigner([other.address], true))
        .to.emit(module, "WhitelistedSignersUpdated")
        .withArgs([other.address], true);
    });

    it("prevents non-owner from whitelisting signers", async () => {
      const {module} = await setupSession(2);
      const [, other] = await ethers.getSigners();

      await expect(module.connect(other).setWhitelistedSigner([other.address], true)).to.be.revertedWithCustomError(
        module,
        "OwnableUnauthorizedAccount"
      );
    });

    it("can remove a signer from whitelist", async () => {
      const {module} = await setupSession(2);
      const [, other] = await ethers.getSigners();

      await module.setWhitelistedSigner([other.address], true);
      await module.setWhitelistedSigner([other.address], false);
      const tx = module.connect(other).executeBatch([]); // Empty batch to trigger access check first
      await expect(tx).to.be.revertedWithCustomError(module, "UnauthorizedSigner");
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

      await usageBasedSessionModule.setWhitelistedSigner([owner.address], true);
      await owner.sendTransaction({to: await usageBasedSessionModule.getAddress(), value: ethers.parseEther("1")});

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

      const tx = await module.executeBatch([
        {safe: await safe.getAddress(), target: await playerNFT.getAddress(), data, signature},
      ]);
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
      await module.executeBatch([
        {safe: await safe.getAddress(), target: await playerNFT.getAddress(), data: data1, signature: sig1},
      ]);

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
      await module.executeBatch([
        {safe: await safe.getAddress(), target: await playerNFT.getAddress(), data: data2, signature: sig2},
      ]);

      // Set up a second safe with a fresh session to provide the required passing item for the 3rd batch
      const [owner] = await ethers.getSigners();
      const Safe2 = await ethers.getContractFactory("TestSessionSafe");
      const safe2 = (await Safe2.deploy(owner.address)) as any;
      const sessionKey2 = ethers.Wallet.createRandom();
      await safe2.callEnableSession(module, sessionKey2.address, 3600);
      const session2 = await module.getSession(await safe2.getAddress());
      const data4 = playerNFT.interface.encodeFunctionData("mint", [
        avatarId,
        "FourthHero" + 4,
        "",
        "",
        "",
        false,
        true,
      ]);
      const goodSig = await signCall(
        sessionKey2,
        safe2,
        playerNFT,
        data4,
        0n,
        session2.deadline,
        await module.getAddress()
      );

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
      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await playerNFT.getAddress(), data: data3, signature: sig3},
        {safe: await safe2.getAddress(), target: await playerNFT.getAddress(), data: data4, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(
          await safe.getAddress(),
          playerNFT.interface.getFunction("mint")!.selector,
          module.interface.encodeErrorResult("GroupLimitReached", [])
        );
    });

    it("rejects PlayerNFT mint with invalid session key signature", async () => {
      const {safe, playerNFT, avatarId, module, sessionDeadline, sessionKey} = await setupPlayerNFTSession(5);
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

      const validData = playerNFT.interface.encodeFunctionData("mint", [
        avatarId,
        "GoodKeyHero",
        "",
        "",
        "",
        false,
        true,
      ]);
      const goodSig = await signCall(
        sessionKey,
        safe,
        playerNFT,
        validData,
        0n,
        sessionDeadline,
        await module.getAddress()
      );

      const tx = module.executeBatch([
        {safe: await safe.getAddress(), target: await playerNFT.getAddress(), data, signature},
        {safe: await safe.getAddress(), target: await playerNFT.getAddress(), data: validData, signature: goodSig},
      ]);
      await expect(tx)
        .to.emit(module, "BatchItemFailed")
        .withArgs(
          await safe.getAddress(),
          playerNFT.interface.getFunction("mint")!.selector,
          module.interface.encodeErrorResult("InvalidSignature", [])
        );
    });
  });
});
