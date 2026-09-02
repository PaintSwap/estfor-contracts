// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

/// @notice Broadcasts the optional beta test-data lifecycle at the end of scripts/deploy.ts.
/// @dev Time advances between phases are performed by the local deployment wrapper. Every state-changing
/// contract call in these phases is broadcast by Forge.
contract SeedTestData is Script {
  string private dataDir;
  string private deploymentPath;
  string private deploymentJson;

  address private owner;
  address private alice;
  address private brush;
  address private itemNFT;
  address private playerNFT;
  address private players;
  address private shop;
  address private clans;
  address private bankFactory;
  address private orderBook;
  address private quests;

  function run() external {
    require(block.chainid == 31337, "SeedTestData: chain id must be 31337");
    uint256 ownerKey = vm.envUint("PRIVATE_KEY");
    uint256 aliceKey = vm.envUint("ALICE_PRIVATE_KEY");
    owner = vm.addr(ownerKey);
    alice = vm.addr(aliceKey);
    dataDir = vm.envOr("DEPLOY_DATA_DIR", string(".forge-deploy-data"));
    deploymentPath = vm.envOr("DEPLOYMENT_INPUT", string(".deployments/deployment.json"));
    deploymentJson = vm.readFile(deploymentPath);
    _loadContracts();

    uint256 phase = vm.envUint("TEST_DATA_PHASE");
    if (phase == 8) {
      _phase8(ownerKey, aliceKey);
    } else {
      vm.startBroadcast(ownerKey);
      if (phase == 1) _phase1();
      else if (phase == 2) _phase2();
      else if (phase == 3) _phase3();
      else if (phase == 4) _phase4();
      else if (phase == 5) _phase5(ownerKey);
      else if (phase == 6) _phase6();
      else if (phase == 7) _phase7();
      else revert("SeedTestData: unknown phase");
      vm.stopBroadcast();
      if (phase == 7) _recordTestClanBank();
    }
    console2.log("Completed test-data phase", phase);
  }

  function _phase1() private {
    _call(playerNFT, _testCall("mintOwner", _a0()));
    _call(players, _testCall("startWoodcutting", _a0()));
  }

  function _phase2() private {
    _call(players, _testCall("processActions", _a0()));
    _call(players, _testCall("startFiremaking", _a0()));
  }

  function _phase3() private {
    _call(players, _testCall("processActions", _a0()));
    _call(players, _testCall("startWoodcutting", _a0()));
  }

  function _phase4() private {
    _call(itemNFT, _testCall("mintBronzeHelmet", _a(owner)));
    _call(players, _testCall("startCombat", _a0()));
  }

  function _phase5(uint256 ownerKey) private {
    _call(players, _testCall("processActions", _a0()));
    _call(brush, _testCall("approveShop", _a(shop)));
    _call(shop, _testCall("buyFromShop", _a(owner)));
    _call(brush, _testCall("fundShop", _a(shop)));
    _call(itemNFT, _testCall("mintShopInventory", _a(owner)));

    // The old deployment checks that a newly minted item cannot be sold before the cutoff.
    // Keep that assertion in simulation without broadcasting an intentionally reverted transaction.
    vm.stopBroadcast();
    vm.prank(owner);
    (bool success, ) = shop.call(_testCall("sellTooEarly", _a0()));
    require(!success, "SeedTestData: early sale unexpectedly succeeded");
    vm.startBroadcast(ownerKey);
  }

  function _phase6() private {
    _call(shop, _testCall("sellToShop", _a0()));
    _call(players, _testCall("activateQuest", _a0()));
    _call(players, _testCall("startFiremaking", _a0()));
  }

  function _phase7() private {
    _call(players, _testCall("deactivateQuest", _a0()));
    _call(players, _testCall("activateQuest", _a0()));
    _call(brush, _testCall("approveClans", _a(clans)));
    _call(clans, _testCall("createClan", _a0()));

    (bool success, bytes memory result) = bankFactory.staticcall(
      abi.encodeWithSignature("getBankAddress(uint256)", 30_000)
    );
    require(success, "SeedTestData: bank lookup failed");
    address bank = abi.decode(result, (address));
    require(bank.code.length != 0, "SeedTestData: clan bank was not deployed");
    _call(itemNFT, _testCall("transferToBank", _a(owner, bank)));
  }

  function _phase8(uint256 ownerKey, uint256 aliceKey) private {
    vm.startBroadcast(aliceKey);
    _call(playerNFT, _testCall("mintAlice", _a0()));
    vm.stopBroadcast();

    vm.startBroadcast(ownerKey);
    _call(clans, _testCall("inviteAlice", _a0()));
    vm.stopBroadcast();

    vm.startBroadcast(aliceKey);
    _call(clans, _testCall("acceptInvite", _a0()));
    _call(clans, _testCall("leaveClan", _a0()));
    vm.stopBroadcast();

    vm.startBroadcast(ownerKey);
    _call(clans, _testCall("inviteAlice", _a0()));
    vm.stopBroadcast();

    vm.startBroadcast(aliceKey);
    _call(clans, _testCall("requestToJoin", _a0()));
    _call(clans, _testCall("deleteInvitesAsPlayer", _a0()));
    vm.stopBroadcast();

    vm.startBroadcast(ownerKey);
    _call(clans, _testCall("inviteAlice", _a0()));
    _call(clans, _testCall("deleteInvitesAsClan", _a0()));
    _call(clans, _testCall("inviteAlice", _a0()));
    vm.stopBroadcast();

    vm.startBroadcast(aliceKey);
    _call(orderBook, _testCall("limitOrder", _a0()));
    vm.stopBroadcast();

    vm.startBroadcast(ownerKey);
    _callValue(quests, _testCall("buyBrush", _a(owner)), 0.001 ether);
    _call(brush, _testCall("approveQuests", _a(quests)));
    _call(quests, _testCall("sellBrush", _a(owner)));
    vm.stopBroadcast();
  }

  function _recordTestClanBank() private {
    (bool success, bytes memory result) = bankFactory.staticcall(
      abi.encodeWithSignature("getBankAddress(uint256)", 30_000)
    );
    require(success, "SeedTestData: bank lookup failed");
    address bank = abi.decode(result, (address));
    require(bank.code.length != 0, "SeedTestData: clan bank was not deployed");
    vm.writeJson(string.concat('"', vm.toString(bank), '"'), deploymentPath, ".testClanBank");
  }

  function _loadContracts() private {
    brush = _load("brush");
    itemNFT = _load("itemNFT");
    playerNFT = _load("playerNFT");
    players = _load("players");
    shop = _load("shop");
    clans = _load("clans");
    bankFactory = _load("bankFactory");
    orderBook = _load("orderBook");
    quests = _load("quests");
  }

  function _load(string memory name) private view returns (address) {
    return vm.parseJsonAddress(deploymentJson, string.concat(".", name));
  }

  function _testCall(string memory name, address[] memory replacements) private view returns (bytes memory data) {
    data = vm.readFileBinary(string.concat(dataDir, "/test/", name, ".bin"));
    for (uint256 offset = 4; offset + 32 <= data.length; offset += 32) {
      uint256 word;
      assembly ("memory-safe") {
        word := mload(add(add(data, 0x20), offset))
      }
      for (uint256 i; i < replacements.length; ++i) {
        uint256 placeholder = uint256(uint160(bytes20(hex"f000000000000000000000000000000000000000"))) + i + 1;
        if (word == placeholder) {
          address replacement = replacements[i];
          assembly ("memory-safe") {
            mstore(add(add(data, 0x20), offset), replacement)
          }
          break;
        }
      }
    }
  }

  function _call(address target, bytes memory data) private {
    _callValue(target, data, 0);
  }

  function _callValue(address target, bytes memory data, uint256 value) private {
    (bool success, bytes memory result) = target.call{value: value}(data);
    if (!success) {
      assembly ("memory-safe") {
        revert(add(result, 0x20), mload(result))
      }
    }
  }

  function _a0() private pure returns (address[] memory values) {
    values = new address[](0);
  }

  function _a(address a) private pure returns (address[] memory values) {
    values = new address[](1);
    values[0] = a;
  }

  function _a(address a, address b) private pure returns (address[] memory values) {
    values = new address[](2);
    values[0] = a;
    values[1] = b;
  }
}
