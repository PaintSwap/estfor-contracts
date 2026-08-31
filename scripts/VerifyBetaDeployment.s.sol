// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

/// @notice Verifies the persistent local beta deployment through RPC-backed assertions.
contract VerifyBetaDeployment is Script {
    bytes32 private constant IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 private constant ACTIVITY_POINT_CALLER = keccak256("ACTIVITY_POINT_CALLER");

    string private deploymentJson;
    string private manifestJson;
    address private owner;

    function run() external {
        require(block.chainid == 31337, "VerifyBetaDeployment: chain id must be 31337");
        deploymentJson = vm.readFile(vm.envOr("DEPLOYMENT_INPUT", string(".deployments/beta-local.json")));
        manifestJson =
            vm.readFile(string.concat(vm.envOr("DEPLOY_DATA_DIR", string(".forge-deploy-data")), "/manifest.json"));
        require(vm.parseJsonUint(deploymentJson, ".chainId") == block.chainid, "deployment chain id mismatch");
        owner = _load("owner");

        _assertAllRecordedContractsHaveCode();
        _assertProxyWiringAndOwnership();
        _assertBeacon();
        _assertGameWiring();
        _assertSeededData();
        _assertBetaLifecycle();

        console2.log("Verified deployed bytecode addresses", vm.parseJsonKeys(deploymentJson, ".").length - 2);
        console2.log("Verified complete beta deployment on chain", block.chainid);
    }

    function _assertAllRecordedContractsHaveCode() private view {
        string[] memory keys = vm.parseJsonKeys(deploymentJson, ".");
        for (uint256 i; i < keys.length; ++i) {
            bytes32 keyHash = keccak256(bytes(keys[i]));
            if (keyHash == keccak256("chainId") || keyHash == keccak256("owner")) continue;
            require(_load(keys[i]).code.length != 0, string.concat("no bytecode at ", keys[i]));
        }
    }

    function _assertProxyWiringAndOwnership() private view {
        _assertProxy("bridge", "bridgeImplementation");
        _assertProxy("worldActions", "worldActionsImplementation");
        _assertProxy("randomnessBeacon", "randomnessBeaconImplementation");
        _assertProxy("dailyRewardsScheduler", "dailyRewardsSchedulerImplementation");
        _assertProxy("treasury", "treasuryImplementation");
        _assertProxy("shop", "shopImplementation");
        _assertProxy("royaltyReceiver", "royaltyReceiverImplementation");
        _assertProxy("adminAccess", "adminAccessImplementation");
        _assertProxy("itemNFT", "itemNFTImplementation");
        _assertProxy("activityPoints", "activityPointsImplementation");
        _assertProxy("orderBook", "orderBookImplementation");
        _assertProxy("marketplace", "marketplaceImplementation");
        _assertProxy("playerNFT", "playerNFTImplementation");
        _assertProxy("cosmetics", "cosmeticsImplementation");
        _assertProxy("blackMarketTrader", "blackMarketTraderImplementation");
        _assertProxy("quests", "questsImplementation");
        _assertProxy("clans", "clansImplementationV2");
        _assertProxy("wishingWell", "wishingWellImplementation");
        _assertProxy("petNFT", "petNFTImplementation");
        _assertProxy("petNFTReroll", "petNFTRerollImplementation");
        _assertProxy("players", "playersImplementation");
        _assertProxy("promotions", "promotionsImplementation");
        _assertProxy("globalEvents", "globalEventsImplementation");
        _assertProxy("passiveActions", "passiveActionsImplementation");
        _assertProxy("instantActions", "instantActionsImplementation");
        _assertProxy("instantVRFActions", "instantVRFActionsImplementation");
        _assertProxy("genericInstantVRFActionStrategy", "genericInstantVRFActionStrategyImplementation");
        _assertProxy("eggInstantVRFActionStrategy", "eggInstantVRFActionStrategyImplementation");
        _assertProxy("bankRelay", "bankRelayImplementation");
        _assertProxy("pvpBattleground", "pvpBattlegroundImplementation");
        _assertProxy("raids", "raidsImplementation");
        _assertProxy("lockedBankVaults", "lockedBankVaultsImplementation");
        _assertProxy("territories", "territoriesImplementation");
        _assertProxy("combatantsHelper", "combatantsHelperImplementation");
        _assertProxy("gameSubsidisationRegistry", "gameSubsidisationRegistryImplementation");
        _assertProxy("usageBasedSessionModule", "usageBasedSessionModuleImplementation");
        _assertProxy("territoryTreasury", "territoryTreasuryImplementation");
        _assertProxy("bankRegistry", "bankRegistryImplementation");
        _assertProxy("bankFactory", "bankFactoryImplementation");
    }

    function _assertProxy(string memory proxyName, string memory implementationName) private view {
        address proxy = _load(proxyName);
        address expectedImplementation = _load(implementationName);
        address actualImplementation = address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT))));
        require(
            actualImplementation == expectedImplementation, string.concat("implementation mismatch for ", proxyName)
        );

        (bool success, bytes memory result) = proxy.staticcall(abi.encodeWithSignature("owner()"));
        require(success && abi.decode(result, (address)) == owner, string.concat("owner mismatch for ", proxyName));
    }

    function _assertBeacon() private view {
        address beacon = _load("bankBeacon");
        (bool success, bytes memory result) = beacon.staticcall(abi.encodeWithSignature("implementation()"));
        require(success && abi.decode(result, (address)) == _load("bankImplementation"), "bank beacon implementation");
        (success, result) = beacon.staticcall(abi.encodeWithSignature("owner()"));
        require(success && abi.decode(result, (address)) == owner, "bank beacon owner");
    }

    function _assertGameWiring() private view {
        require(
            _boolCall(_load("bankRegistry"), "isForceItemDepositor(address)", _load("activityPoints")),
            "activity depositor"
        );
        require(_boolCall(_load("bankRegistry"), "isForceItemDepositor(address)", _load("raids")), "raids depositor");
        (bool success, bytes memory result) = _load("activityPoints")
            .staticcall(abi.encodeWithSignature("hasRole(bytes32,address)", ACTIVITY_POINT_CALLER, _load("players")));
        require(success && abi.decode(result, (bool)), "players activity caller");
        require(
            _addressCall(_load("instantVRFActions"), "getStrategy(uint8)", 1)
                == _load("genericInstantVRFActionStrategy"),
            "generic strategy"
        );
        require(
            _addressCall(_load("instantVRFActions"), "getStrategy(uint8)", 2)
                == _load("genericInstantVRFActionStrategy"),
            "forging strategy"
        );
        require(
            _addressCall(_load("instantVRFActions"), "getStrategy(uint8)", 3) == _load("eggInstantVRFActionStrategy"),
            "egg strategy"
        );
        require(_load("randomnessBeacon").balance == 10 ether, "randomness beacon funding");
        require(_load("raids").balance == 10 ether, "raids funding");
    }

    function _assertSeededData() private view {
        uint256 itemId = _manifestUint("itemId");
        uint256 actionId = _manifestUint("actionId");
        uint256 actionChoiceActionId = _manifestUint("actionChoiceActionId");
        uint256 actionChoiceId = _manifestUint("actionChoiceId");
        uint256 questId = _manifestUint("questId");
        uint256 orderbookTokenId = _manifestUint("orderbookTokenId");
        uint256 clanTierId = _manifestUint("clanTierId");
        uint256 territoryId = _manifestUint("territoryId");
        uint256 shopItemId = _manifestUint("shopItemId");

        _assertNonZeroCall(_load("itemNFT"), abi.encodeWithSignature("getItem(uint16)", itemId), "item");
        _assertNonZeroCall(_load("worldActions"), abi.encodeWithSignature("getAction(uint256)", actionId), "action");
        _assertNonZeroCall(
            _load("worldActions"),
            abi.encodeWithSignature("getActionChoice(uint16,uint16)", actionChoiceActionId, actionChoiceId),
            "action choice"
        );
        _assertNonZeroCall(_load("quests"), abi.encodeWithSignature("allFixedQuests(uint256)", questId), "quest");
        _assertNonZeroCall(
            _load("dailyRewardsScheduler"),
            abi.encodeWithSignature("getSpecificDailyReward(uint256,uint256,uint256,uint256)", 1, 200_000, 1, 1),
            "daily reward"
        );
        _assertNonZeroCall(
            _load("dailyRewardsScheduler"),
            abi.encodeWithSignature("getWeeklyReward(uint256,uint256)", 1, 200_000),
            "weekly reward"
        );
        _assertNonZeroCall(
            _load("orderBook"), abi.encodeWithSignature("getTokenIdInfo(uint256)", orderbookTokenId), "orderbook"
        );
        _assertNonZeroCall(_load("clans"), abi.encodeWithSignature("getTier(uint256)", clanTierId), "clan tier");
        _assertNonZeroCall(
            _load("instantActions"),
            abi.encodeWithSignature(
                "getAction(uint8,uint16)", _manifestUint("instantActionType"), _manifestUint("instantActionId")
            ),
            "instant action"
        );
        _assertNonZeroCall(
            _load("instantVRFActions"),
            abi.encodeWithSignature("getAction(uint16)", _manifestUint("instantVRFActionId")),
            "instant VRF action"
        );
        _assertNonZeroCall(
            _load("passiveActions"),
            abi.encodeWithSignature("getAction(uint16)", _manifestUint("passiveActionId")),
            "passive action"
        );
        _assertNonZeroCall(
            _load("territories"), abi.encodeWithSignature("getTerritory(uint256)", territoryId), "territory"
        );

        (bool success, bytes memory result) =
            _load("shop").staticcall(abi.encodeWithSignature("shopItems(uint16)", shopItemId));
        require(success && abi.decode(result, (uint256)) != 0, "shop item");

        (success, result) =
            _load("shop").staticcall(abi.encodeWithSignature("tokenInfos(uint16)", _manifestUint("unsellableItemId")));
        (,,, bool unsellable) = abi.decode(result, (uint80, uint80, uint40, bool));
        require(success && unsellable, "unsellable item");
    }

    function _assertBetaLifecycle() private view {
        require(_addressCall(_load("playerNFT"), "ownerOf(uint256)", 200_000) == owner, "owner beta player");
        address alice = vm.addr(vm.envUint("ALICE_PRIVATE_KEY"));
        require(_addressCall(_load("playerNFT"), "ownerOf(uint256)", 200_001) == alice, "alice beta player");

        (bool success, bytes memory result) =
            _load("clans").staticcall(abi.encodeWithSignature("getClan(uint256)", 30_000));
        require(success && uint256(bytes32(result)) == 200_000, "beta clan");
        (success, result) = _load("bankFactory").staticcall(abi.encodeWithSignature("getBankAddress(uint256)", 30_000));
        address bank = abi.decode(result, (address));
        require(success && bank == _load("betaClanBank") && bank.code.length != 0, "beta clan bank");

        (success, result) = _load("orderBook").staticcall(abi.encodeWithSignature("getLowestAsk(uint256)", 3328));
        require(success && abi.decode(result, (uint72)) != 0, "beta limit order");
    }

    function _assertNonZeroCall(address target, bytes memory callData, string memory label) private view {
        (bool success, bytes memory result) = target.staticcall(callData);
        require(success && _hasNonZeroByte(result), string.concat("missing seeded ", label));
    }

    function _hasNonZeroByte(bytes memory value) private pure returns (bool) {
        for (uint256 i; i < value.length; ++i) {
            if (value[i] != 0) return true;
        }
        return false;
    }

    function _boolCall(address target, string memory signature, address argument) private view returns (bool) {
        (bool success, bytes memory result) = target.staticcall(abi.encodeWithSignature(signature, argument));
        require(success, signature);
        return abi.decode(result, (bool));
    }

    function _addressCall(address target, string memory signature, uint256 argument) private view returns (address) {
        (bool success, bytes memory result) = target.staticcall(abi.encodeWithSignature(signature, argument));
        require(success, signature);
        return abi.decode(result, (address));
    }

    function _manifestUint(string memory key) private view returns (uint256) {
        return vm.parseJsonUint(manifestJson, string.concat(".representative.", key));
    }

    function _load(string memory name) private view returns (address) {
        return vm.parseJsonAddress(deploymentJson, string.concat(".", name));
    }
}
