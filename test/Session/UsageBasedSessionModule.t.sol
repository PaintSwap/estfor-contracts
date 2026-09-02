// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IUsageBasedSessionModule} from "../../contracts/interfaces/IUsageBasedSessionModule.sol";
import {IPlayerNFT as PlayerNFT} from "../../contracts/interfaces/IPlayerNFT.sol";
import {EstforTest} from "../utils/EstforTest.sol";
import {FullGameStack} from "../utils/FullGameStack.sol";

interface TestSessionSafe {
  function callEnableSession(IUsageBasedSessionModule module, address sessionKey, uint48 duration) external;
  function callRevokeSession(IUsageBasedSessionModule module) external;
}

interface TestSessionTarget {
  function calls() external view returns (uint256);
  function doAction() external;
}

interface TestSessionRevertingTarget {
  function revertAction() external pure;
}

contract UsageBasedSessionModuleTest is EstforTest {
  uint256 private constant SESSION_KEY = 0x51A;
  uint256 private constant SECOND_SESSION_KEY = 0x52A;
  uint48 private constant SESSION_DURATION = 1 hours;
  bytes4 private constant DO_ACTION_SELECTOR = TestSessionTarget.doAction.selector;

  TestSessionSafe private safe;
  TestSessionTarget private target;
  uint48 private sessionDeadline;

  function setUp() public {
    _deploySessionStack();
    (safe, target, sessionDeadline) = _createSession(SESSION_KEY, 2);
    usageBasedSessionModule.setWhitelistedSigner(_addresses(address(this)), true);
    vm.deal(address(usageBasedSessionModule), 1 ether);
  }

  function testExecutesAllowedActionAndConsumesDailyQuota() public {
    usageBasedSessionModule.executeBatch(_single(_signedParams(safe, target, SESSION_KEY, 0, sessionDeadline)));

    assertEq(target.calls(), 1);
  }

  function testCannotEnableSessionWithZeroKey() public {
    vm.expectRevert(IUsageBasedSessionModule.ZeroSessionKey.selector);
    safe.callEnableSession(usageBasedSessionModule, address(0), SESSION_DURATION);
  }

  function testCannotEnableSessionWithZeroDuration() public {
    vm.expectRevert(IUsageBasedSessionModule.InvalidSessionDuration.selector);
    safe.callEnableSession(usageBasedSessionModule, vm.addr(SECOND_SESSION_KEY), 0);
  }

  function testCannotEnableSessionBeyondMaximumDuration() public {
    uint48 maxDuration = usageBasedSessionModule.MAX_SESSION_DURATION();
    vm.expectRevert(IUsageBasedSessionModule.InvalidSessionDuration.selector);
    safe.callEnableSession(usageBasedSessionModule, vm.addr(SECOND_SESSION_KEY), maxDuration + 1);
  }

  function testRevokesActiveSession() public {
    vm.expectEmit(true, false, false, false, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.SessionRevoked(address(safe));
    safe.callRevokeSession(usageBasedSessionModule);

    IUsageBasedSessionModule.Session memory session = usageBasedSessionModule.getSession(address(safe));
    assertEq(session.sessionKey, address(0));
  }

  function testRejectsShortCalldata() public {
    IUsageBasedSessionModule.ExecuteParams memory bad = IUsageBasedSessionModule.ExecuteParams({
      safe: address(safe),
      target: address(0),
      data: hex"123456",
      value: 0,
      signature: ""
    });

    _expectFailedItem(bad, bytes4(0), IUsageBasedSessionModule.InvalidCallData.selector);
  }

  function testRejectsSafeWithoutActiveSession() public {
    safe.callRevokeSession(usageBasedSessionModule);
    IUsageBasedSessionModule.ExecuteParams memory bad = IUsageBasedSessionModule.ExecuteParams({
      safe: address(safe),
      target: address(target),
      data: abi.encodeCall(target.doAction, ()),
      value: 0,
      signature: ""
    });

    _expectFailedItem(bad, DO_ACTION_SELECTOR, IUsageBasedSessionModule.NoSessionKey.selector);
  }

  function testRejectsExpiredSession() public {
    vm.warp(block.timestamp + SESSION_DURATION + 1);
    IUsageBasedSessionModule.ExecuteParams memory bad = _signedParams(safe, target, SESSION_KEY, 0, sessionDeadline);

    _expectFailedItem(bad, DO_ACTION_SELECTOR, IUsageBasedSessionModule.SessionExpired.selector);
  }

  function testRejectsActionWithoutGroup() public {
    TestSessionTarget unmappedTarget = _deployTarget();
    IUsageBasedSessionModule.ExecuteParams memory bad = _signedParams(
      safe,
      unmappedTarget,
      SESSION_KEY,
      0,
      sessionDeadline
    );

    _expectFailedItem(bad, DO_ACTION_SELECTOR, IUsageBasedSessionModule.ActionNotPermitted.selector);
  }

  function testRejectsRevertingTargetCall() public {
    TestSessionRevertingTarget revertingTarget = _deployRevertingTarget();
    gameSubsidisationRegistry.setFunctionGroup(
      address(revertingTarget),
      TestSessionRevertingTarget.revertAction.selector,
      1
    );
    bytes memory data = abi.encodeCall(revertingTarget.revertAction, ());
    IUsageBasedSessionModule.ExecuteParams memory bad = IUsageBasedSessionModule.ExecuteParams({
      safe: address(safe),
      target: address(revertingTarget),
      data: data,
      value: 0,
      signature: _sign(SESSION_KEY, address(safe), address(revertingTarget), data, 0, sessionDeadline)
    });

    _expectFailedItem(
      bad,
      TestSessionRevertingTarget.revertAction.selector,
      IUsageBasedSessionModule.ModuleCallFailed.selector
    );
  }

  function testRejectsWrongSessionKey() public {
    IUsageBasedSessionModule.ExecuteParams memory bad = _signedParams(
      safe,
      target,
      SECOND_SESSION_KEY,
      0,
      sessionDeadline
    );

    _expectFailedItem(bad, DO_ACTION_SELECTOR, IUsageBasedSessionModule.InvalidSignature.selector);
  }

  function testRejectsWrongNonce() public {
    IUsageBasedSessionModule.ExecuteParams memory bad = _signedParams(safe, target, SESSION_KEY, 1, sessionDeadline);

    _expectFailedItem(bad, DO_ACTION_SELECTOR, IUsageBasedSessionModule.InvalidSignature.selector);
  }

  function testRejectsWrongSignedTarget() public {
    TestSessionTarget otherTarget = _deployTarget();
    bytes memory data = abi.encodeCall(target.doAction, ());
    IUsageBasedSessionModule.ExecuteParams memory bad = IUsageBasedSessionModule.ExecuteParams({
      safe: address(safe),
      target: address(target),
      data: data,
      value: 0,
      signature: _sign(SESSION_KEY, address(safe), address(otherTarget), data, 0, sessionDeadline)
    });

    _expectFailedItem(bad, DO_ACTION_SELECTOR, IUsageBasedSessionModule.InvalidSignature.selector);
  }

  function testEnforcesGroupDailyLimit() public {
    usageBasedSessionModule.executeBatch(_single(_signedParams(safe, target, SESSION_KEY, 0, sessionDeadline)));
    usageBasedSessionModule.executeBatch(_single(_signedParams(safe, target, SESSION_KEY, 1, sessionDeadline)));

    _expectFailedItem(
      _signedParams(safe, target, SESSION_KEY, 2, sessionDeadline),
      DO_ACTION_SELECTOR,
      IUsageBasedSessionModule.GroupLimitReached.selector
    );
  }

  function testBatchSupportsMixedResultsForSameSafe() public {
    gameSubsidisationRegistry.setGroupLimit(1, 5);
    TestSessionRevertingTarget revertingTarget = _deployRevertingTarget();
    gameSubsidisationRegistry.setFunctionGroup(
      address(revertingTarget),
      TestSessionRevertingTarget.revertAction.selector,
      1
    );
    bytes memory failingData = abi.encodeCall(revertingTarget.revertAction, ());
    IUsageBasedSessionModule.ExecuteParams[] memory params = new IUsageBasedSessionModule.ExecuteParams[](3);
    params[0] = _signedParams(safe, target, SESSION_KEY, 0, sessionDeadline);
    params[1] = IUsageBasedSessionModule.ExecuteParams({
      safe: address(safe),
      target: address(revertingTarget),
      data: failingData,
      value: 0,
      signature: _sign(SESSION_KEY, address(safe), address(revertingTarget), failingData, 1, sessionDeadline)
    });
    params[2] = _signedParams(safe, target, SESSION_KEY, 1, sessionDeadline);

    uint256 currentDay = block.timestamp / 1 days;
    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.SessionNonceIncremented(address(safe), 1, 1, 1, currentDay, 5);
    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.BatchItemFailed(
      address(safe),
      TestSessionRevertingTarget.revertAction.selector,
      abi.encodeWithSelector(IUsageBasedSessionModule.ModuleCallFailed.selector)
    );
    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.SessionNonceIncremented(address(safe), 2, 1, 2, currentDay, 5);
    usageBasedSessionModule.executeBatch(params);

    assertEq(target.calls(), 2);
  }

  function testBatchSupportsMixedResultsForDifferentSafes() public {
    gameSubsidisationRegistry.setGroupLimit(1, 5);
    (TestSessionSafe safe2, TestSessionTarget target2, uint48 deadline2) = _createSession(SECOND_SESSION_KEY, 5);
    IUsageBasedSessionModule.ExecuteParams[] memory params = new IUsageBasedSessionModule.ExecuteParams[](2);
    params[0] = _signedParams(safe, target, SESSION_KEY, 0, sessionDeadline);
    params[1] = _signedParams(safe2, target2, SECOND_SESSION_KEY, 999, deadline2);

    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.SessionNonceIncremented(address(safe), 1, 1, 1, block.timestamp / 1 days, 5);
    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.BatchItemFailed(
      address(safe2),
      DO_ACTION_SELECTOR,
      abi.encodeWithSelector(IUsageBasedSessionModule.InvalidSignature.selector)
    );
    usageBasedSessionModule.executeBatch(params);

    assertEq(target.calls(), 1);
    assertEq(target2.calls(), 0);
  }

  function testDuplicateBatchItemCannotBeReplayed() public {
    gameSubsidisationRegistry.setGroupLimit(1, 5);
    IUsageBasedSessionModule.ExecuteParams memory item = _signedParams(safe, target, SESSION_KEY, 0, sessionDeadline);
    IUsageBasedSessionModule.ExecuteParams[] memory params = new IUsageBasedSessionModule.ExecuteParams[](2);
    params[0] = item;
    params[1] = item;

    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.BatchItemFailed(
      address(safe),
      DO_ACTION_SELECTOR,
      abi.encodeWithSelector(IUsageBasedSessionModule.InvalidSignature.selector)
    );
    usageBasedSessionModule.executeBatch(params);

    assertEq(target.calls(), 1);
  }

  function testRejectsEmptyBatch() public {
    vm.expectRevert(IUsageBasedSessionModule.NoBatchItems.selector);
    usageBasedSessionModule.executeBatch(new IUsageBasedSessionModule.ExecuteParams[](0));
  }

  function testTracksDailyLimitsSeparatelyByGroup() public {
    gameSubsidisationRegistry.setGroupLimit(1, 1);
    gameSubsidisationRegistry.setGroupLimit(2, 1);

    usageBasedSessionModule.executeBatch(_single(_signedParams(safe, target, SESSION_KEY, 0, sessionDeadline)));
    gameSubsidisationRegistry.setFunctionGroup(address(target), DO_ACTION_SELECTOR, 2);
    usageBasedSessionModule.executeBatch(_single(_signedParams(safe, target, SESSION_KEY, 1, sessionDeadline)));

    assertEq(target.calls(), 2);
    gameSubsidisationRegistry.setFunctionGroup(address(target), DO_ACTION_SELECTOR, 0);
    _expectFailedItem(
      _signedParams(safe, target, SESSION_KEY, 2, sessionDeadline),
      DO_ACTION_SELECTOR,
      IUsageBasedSessionModule.ActionNotPermitted.selector
    );
  }

  function testRejectsNonWhitelistedSigner() public {
    vm.prank(ALICE);
    vm.expectRevert(IUsageBasedSessionModule.UnauthorizedSigner.selector);
    usageBasedSessionModule.executeBatch(_single(_signedParams(safe, target, SESSION_KEY, 0, sessionDeadline)));
  }

  function testRefundsWhitelistedSigner() public {
    usageBasedSessionModule.setWhitelistedSigner(_addresses(ALICE), true);
    vm.txGasPrice(20 gwei);
    uint256 balanceBefore = ALICE.balance;

    vm.prank(ALICE);
    usageBasedSessionModule.executeBatch(_single(_signedParams(safe, target, SESSION_KEY, 0, sessionDeadline)));

    assertGt(ALICE.balance, balanceBefore);
  }

  function testRevokeFailsAfterDailySessionOperationLimit() public {
    usageBasedSessionModule.setSessionOpsPerDay(1);
    (TestSessionSafe limitedSafe, , ) = _createSession(SECOND_SESSION_KEY, 2);

    vm.expectRevert(IUsageBasedSessionModule.SessionOpsPerDayLimitReached.selector);
    limitedSafe.callRevokeSession(usageBasedSessionModule);
  }

  function testRevokeSucceedsWithinDailySessionOperationLimit() public {
    vm.expectEmit(true, false, false, false, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.SessionRevoked(address(safe));
    safe.callRevokeSession(usageBasedSessionModule);

    assertEq(usageBasedSessionModule.getSession(address(safe)).sessionKey, address(0));
  }

  function testReenableAndRevokeEnforceDailySessionOperationLimit() public {
    safe.callRevokeSession(usageBasedSessionModule);
    safe.callEnableSession(usageBasedSessionModule, vm.addr(SECOND_SESSION_KEY), SESSION_DURATION);
    safe.callRevokeSession(usageBasedSessionModule);
    safe.callEnableSession(usageBasedSessionModule, vm.addr(SESSION_KEY), SESSION_DURATION);

    vm.expectRevert(IUsageBasedSessionModule.SessionOpsPerDayLimitReached.selector);
    safe.callRevokeSession(usageBasedSessionModule);
  }

  function testEnableFailsWhenDailySessionOperationLimitIsExhausted() public {
    usageBasedSessionModule.setSessionOpsPerDay(2);
    (TestSessionSafe limitedSafe, , ) = _createSession(SECOND_SESSION_KEY, 2);
    limitedSafe.callRevokeSession(usageBasedSessionModule);

    vm.expectRevert(IUsageBasedSessionModule.SessionOpsPerDayLimitReached.selector);
    limitedSafe.callEnableSession(usageBasedSessionModule, vm.addr(SESSION_KEY), SESSION_DURATION);
  }

  function testDailySessionOperationLimitResetsNextDay() public {
    usageBasedSessionModule.setSessionOpsPerDay(2);
    (TestSessionSafe limitedSafe, , ) = _createSession(SECOND_SESSION_KEY, 2);
    limitedSafe.callRevokeSession(usageBasedSessionModule);

    vm.expectRevert(IUsageBasedSessionModule.SessionOpsPerDayLimitReached.selector);
    limitedSafe.callEnableSession(usageBasedSessionModule, vm.addr(SESSION_KEY), SESSION_DURATION);
    vm.warp(block.timestamp + 1 days);

    vm.expectEmit(true, true, false, false, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.SessionEnabled(
      address(limitedSafe),
      vm.addr(SESSION_KEY),
      uint48(block.timestamp + SESSION_DURATION)
    );
    limitedSafe.callEnableSession(usageBasedSessionModule, vm.addr(SESSION_KEY), SESSION_DURATION);

    assertEq(usageBasedSessionModule.getSession(address(limitedSafe)).sessionKey, vm.addr(SESSION_KEY));
  }

  function testRevokePreservesOperationDayAndCount() public {
    safe.callRevokeSession(usageBasedSessionModule);

    IUsageBasedSessionModule.Session memory session = usageBasedSessionModule.getSession(address(safe));
    assertEq(session.sessionKey, address(0));
    assertEq(session.opDay, uint32(block.timestamp / 1 days));
    assertEq(session.opCount, 2);

    safe.callEnableSession(usageBasedSessionModule, vm.addr(SECOND_SESSION_KEY), SESSION_DURATION);
  }

  function testOwnerCanUpdateSessionOperationsPerDay() public {
    vm.expectEmit(false, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.SessionOpsPerDayUpdated(3);
    usageBasedSessionModule.setSessionOpsPerDay(3);

    assertEq(usageBasedSessionModule.getSessionOpsPerDay(), 3);
  }

  function testNonOwnerCannotUpdateSessionOperationsPerDay() public {
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
    usageBasedSessionModule.setSessionOpsPerDay(3);
  }

  function testSessionOperationsPerDayCannotBeZero() public {
    vm.expectRevert(IUsageBasedSessionModule.InvalidSessionDuration.selector);
    usageBasedSessionModule.setSessionOpsPerDay(0);
  }

  function testGetsConfiguredSessionOperationsPerDay() public {
    assertEq(usageBasedSessionModule.getSessionOpsPerDay(), 5);
    usageBasedSessionModule.setSessionOpsPerDay(3);
    assertEq(usageBasedSessionModule.getSessionOpsPerDay(), 3);
  }

  function testOwnerCanWhitelistSigner() public {
    vm.expectEmit(false, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.WhitelistedSignersUpdated(_addresses(ALICE), true);
    usageBasedSessionModule.setWhitelistedSigner(_addresses(ALICE), true);
  }

  function testNonOwnerCannotWhitelistSigner() public {
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
    usageBasedSessionModule.setWhitelistedSigner(_addresses(ALICE), true);
  }

  function testOwnerCanRemoveWhitelistedSigner() public {
    usageBasedSessionModule.setWhitelistedSigner(_addresses(ALICE), true);
    usageBasedSessionModule.setWhitelistedSigner(_addresses(ALICE), false);

    vm.prank(ALICE);
    vm.expectRevert(IUsageBasedSessionModule.UnauthorizedSigner.selector);
    usageBasedSessionModule.executeBatch(new IUsageBasedSessionModule.ExecuteParams[](0));
  }

  function _createSession(
    uint256 key,
    uint256 groupLimit
  ) private returns (TestSessionSafe newSafe, TestSessionTarget newTarget, uint48 deadline) {
    newSafe = _deploySafe();
    newTarget = _deployTarget();
    gameSubsidisationRegistry.setFunctionGroup(address(newTarget), DO_ACTION_SELECTOR, 1);
    gameSubsidisationRegistry.setGroupLimit(1, groupLimit);
    newSafe.callEnableSession(usageBasedSessionModule, vm.addr(key), SESSION_DURATION);
    deadline = usageBasedSessionModule.getSession(address(newSafe)).deadline;
  }

  function _signedParams(
    TestSessionSafe sessionSafe,
    TestSessionTarget sessionTarget,
    uint256 key,
    uint256 nonce,
    uint48 deadline
  ) private returns (IUsageBasedSessionModule.ExecuteParams memory) {
    bytes memory data = abi.encodeCall(sessionTarget.doAction, ());
    return
      IUsageBasedSessionModule.ExecuteParams({
        safe: address(sessionSafe),
        target: address(sessionTarget),
        data: data,
        value: 0,
        signature: _sign(key, address(sessionSafe), address(sessionTarget), data, nonce, deadline)
      });
  }

  function _sign(
    uint256 key,
    address sessionSafe,
    address sessionTarget,
    bytes memory data,
    uint256 nonce,
    uint48 deadline
  ) private returns (bytes memory) {
    bytes32 typeHash = keccak256(
      "UsageBasedSession(address safe,address target,bytes data,uint256 value,uint256 nonce,uint48 sessionDeadline)"
    );
    bytes32 domainSeparator = keccak256(
      abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256("UsageBasedSessionModule"),
        keccak256("1"),
        block.chainid,
        address(usageBasedSessionModule)
      )
    );
    bytes32 structHash = keccak256(
      abi.encode(typeHash, sessionSafe, sessionTarget, keccak256(data), 0, nonce, deadline)
    );
    bytes32 digest = keccak256(abi.encodePacked(hex"1901", domainSeparator, structHash));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
    return abi.encodePacked(r, s, v);
  }

  function _single(
    IUsageBasedSessionModule.ExecuteParams memory item
  ) private pure returns (IUsageBasedSessionModule.ExecuteParams[] memory params) {
    params = new IUsageBasedSessionModule.ExecuteParams[](1);
    params[0] = item;
  }

  function _expectFailedItem(
    IUsageBasedSessionModule.ExecuteParams memory bad,
    bytes4 selector,
    bytes4 errorSelector
  ) private {
    (TestSessionSafe fallbackSafe, TestSessionTarget fallbackTarget, uint48 fallbackDeadline) = _createSession(
      SECOND_SESSION_KEY,
      2
    );
    IUsageBasedSessionModule.ExecuteParams[] memory params = new IUsageBasedSessionModule.ExecuteParams[](2);
    params[0] = bad;
    params[1] = _signedParams(fallbackSafe, fallbackTarget, SECOND_SESSION_KEY, 0, fallbackDeadline);

    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.BatchItemFailed(bad.safe, selector, abi.encodeWithSelector(errorSelector));
    usageBasedSessionModule.executeBatch(params);
  }

  function _deploySafe() private returns (TestSessionSafe) {
    return
      TestSessionSafe(
        _deployArtifact("contracts/test/Session/TestSessionHelpers.sol:TestSessionSafe", abi.encode(address(this)))
      );
  }

  function _deployTarget() private returns (TestSessionTarget) {
    return TestSessionTarget(_deployArtifact("contracts/test/Session/TestSessionHelpers.sol:TestSessionTarget"));
  }

  function _deployRevertingTarget() private returns (TestSessionRevertingTarget) {
    return
      TestSessionRevertingTarget(
        _deployArtifact("contracts/test/Session/TestSessionHelpers.sol:TestSessionRevertingTarget")
      );
  }
}

contract UsageBasedSessionModulePlayerNFTTest is FullGameStack {
  uint256 private constant SESSION_KEY = 0x51A;
  bytes4 private constant MINT_SELECTOR = PlayerNFT.mint.selector;

  TestSessionSafe private safe;
  uint48 private sessionDeadline;

  function setUp() public {
    deployFullGame();
    safe = _deploySafe();
    gameSubsidisationRegistry.setFunctionGroup(address(playerNFT), MINT_SELECTOR, 1);
    gameSubsidisationRegistry.setGroupLimit(1, 5);
    usageBasedSessionModule.setWhitelistedSigner(_addresses(address(this)), true);
    vm.deal(address(usageBasedSessionModule), 1 ether);
    safe.callEnableSession(usageBasedSessionModule, vm.addr(SESSION_KEY), 1 hours);
    sessionDeadline = usageBasedSessionModule.getSession(address(safe)).deadline;
  }

  function testMintsPlayerNFTThroughSession() public {
    bytes memory data = _mintData("SessionHero1");

    vm.expectEmit(false, false, false, true, address(playerNFT));
    emit PlayerNFT.NewPlayer(playerId + 1, 1, "SessionHero1", address(safe), "", "", "", false);
    usageBasedSessionModule.executeBatch(_single(_params(data, 0, SESSION_KEY)));

    assertEq(playerNFT.balanceOf(address(safe), playerId + 1), 1);
  }

  function testMintsMultiplePlayersWithinDailyLimit() public {
    gameSubsidisationRegistry.setGroupLimit(1, 2);
    usageBasedSessionModule.executeBatch(_single(_params(_mintData("FirstHero1"), 0, SESSION_KEY)));
    usageBasedSessionModule.executeBatch(_single(_params(_mintData("SecondHero2"), 1, SESSION_KEY)));

    TestSessionSafe fallbackSafe = _deploySafe();
    uint256 fallbackKey = 0x52A;
    fallbackSafe.callEnableSession(usageBasedSessionModule, vm.addr(fallbackKey), 1 hours);
    uint48 fallbackDeadline = usageBasedSessionModule.getSession(address(fallbackSafe)).deadline;
    bytes memory fallbackData = _mintData("FourthHero4");
    IUsageBasedSessionModule.ExecuteParams[] memory params = new IUsageBasedSessionModule.ExecuteParams[](2);
    params[0] = _params(_mintData("ThirdHero3"), 2, SESSION_KEY);
    params[1] = _paramsFor(fallbackSafe, fallbackData, 0, fallbackKey, fallbackDeadline);

    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.BatchItemFailed(
      address(safe),
      MINT_SELECTOR,
      abi.encodeWithSelector(IUsageBasedSessionModule.GroupLimitReached.selector)
    );
    usageBasedSessionModule.executeBatch(params);
  }

  function testRejectsPlayerNFTMintSignedByWrongKey() public {
    IUsageBasedSessionModule.ExecuteParams[] memory params = new IUsageBasedSessionModule.ExecuteParams[](2);
    params[0] = _params(_mintData("BadKeyHero"), 0, 0xBAD);
    params[1] = _params(_mintData("GoodKeyHero"), 0, SESSION_KEY);

    vm.expectEmit(true, false, false, true, address(usageBasedSessionModule));
    emit IUsageBasedSessionModule.BatchItemFailed(
      address(safe),
      MINT_SELECTOR,
      abi.encodeWithSelector(IUsageBasedSessionModule.InvalidSignature.selector)
    );
    usageBasedSessionModule.executeBatch(params);
  }

  function _mintData(string memory name) private view returns (bytes memory) {
    return abi.encodeCall(playerNFT.mint, (1, name, "", "", "", false, true));
  }

  function _params(
    bytes memory data,
    uint256 nonce,
    uint256 key
  ) private returns (IUsageBasedSessionModule.ExecuteParams memory) {
    return _paramsFor(safe, data, nonce, key, sessionDeadline);
  }

  function _paramsFor(
    TestSessionSafe sessionSafe,
    bytes memory data,
    uint256 nonce,
    uint256 key,
    uint48 deadline
  ) private returns (IUsageBasedSessionModule.ExecuteParams memory) {
    bytes32 typeHash = keccak256(
      "UsageBasedSession(address safe,address target,bytes data,uint256 value,uint256 nonce,uint48 sessionDeadline)"
    );
    bytes32 domainSeparator = keccak256(
      abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256("UsageBasedSessionModule"),
        keccak256("1"),
        block.chainid,
        address(usageBasedSessionModule)
      )
    );
    bytes32 structHash = keccak256(
      abi.encode(typeHash, address(sessionSafe), address(playerNFT), keccak256(data), 0, nonce, deadline)
    );
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked(hex"1901", domainSeparator, structHash)));
    return
      IUsageBasedSessionModule.ExecuteParams({
        safe: address(sessionSafe),
        target: address(playerNFT),
        data: data,
        value: 0,
        signature: abi.encodePacked(r, s, v)
      });
  }

  function _single(
    IUsageBasedSessionModule.ExecuteParams memory item
  ) private pure returns (IUsageBasedSessionModule.ExecuteParams[] memory params) {
    params = new IUsageBasedSessionModule.ExecuteParams[](1);
    params[0] = item;
  }

  function _deploySafe() private returns (TestSessionSafe) {
    return
      TestSessionSafe(
        _deployArtifact("contracts/test/Session/TestSessionHelpers.sol:TestSessionSafe", abi.encode(address(this)))
      );
  }
}
