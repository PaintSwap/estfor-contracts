// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "../utils/EstforTest.sol";
import {ICombatantsHelper, ICombatantsHelper as CombatantsHelper} from "../../contracts/interfaces/ICombatantsHelper.sol";
import {IPlayers} from "../../contracts/interfaces/IPlayers.sol";
import {IClans} from "../../contracts/interfaces/IClans.sol";
import {ICombatants} from "../../contracts/interfaces/ICombatants.sol";
import {AdminAccess} from "../../contracts/AdminAccess.sol";
import {ClanRank} from "../../contracts/globals/clans.sol";

contract CombatantsPlayersStub {
  mapping(uint256 playerId => bool evolved) public evolved;

  function setEvolved(uint256 playerId, bool value) external {
    evolved[playerId] = value;
  }

  function isPlayerEvolved(uint256 playerId) external view returns (bool) {
    return evolved[playerId];
  }

  function isOwnerOfPlayerAndActive(address, uint256) external pure returns (bool) {
    return true;
  }
}

contract CombatantsClansStub {
  mapping(uint256 clanId => mapping(uint256 playerId => ClanRank rank)) private _ranks;

  function setRank(uint256 clanId, uint256 playerId, ClanRank rank) external {
    _ranks[clanId][playerId] = rank;
  }

  function getRank(uint256 clanId, uint256 playerId) external view returns (ClanRank) {
    return _ranks[clanId][playerId];
  }
}

contract CombatantsStub {
  mapping(uint256 clanId => mapping(uint256 playerId => bool assigned)) private _assigned;
  mapping(uint256 clanId => uint64[] playerIds) private _playerIds;

  function isCombatant(uint256 clanId, uint256 playerId) external view returns (bool) {
    return _assigned[clanId][playerId];
  }

  function assignCombatants(uint256 clanId, uint64[] calldata playerIds, uint256, uint256) external {
    uint64[] storage previousPlayerIds = _playerIds[clanId];
    for (uint256 i; i < previousPlayerIds.length; ++i) {
      _assigned[clanId][previousPlayerIds[i]] = false;
    }
    delete _playerIds[clanId];
    for (uint256 i; i < playerIds.length; ++i) {
      _assigned[clanId][playerIds[i]] = true;
      _playerIds[clanId].push(playerIds[i]);
    }
  }
}

contract CombatantsHelperTest is EstforTest {
  uint256 private constant CLAN_ID = 1;
  uint64 private constant PLAYER_ID = 1;
  uint64 private constant OTHER_PLAYER_ID = 2;

  CombatantsHelper private combatantsHelper;
  CombatantsPlayersStub private players;
  CombatantsClansStub private clans;
  CombatantsStub private territories;
  CombatantsStub private lockedVaults;
  CombatantsStub private raids;

  function setUp() public {
    players = new CombatantsPlayersStub();
    clans = new CombatantsClansStub();
    territories = new CombatantsStub();
    lockedVaults = new CombatantsStub();
    raids = new CombatantsStub();

    clans.setRank(CLAN_ID, PLAYER_ID, ClanRank.OWNER);
    clans.setRank(CLAN_ID, OTHER_PLAYER_ID, ClanRank.COMMONER);

    CombatantsHelper implementation = CombatantsHelper(
      _deployArtifact("contracts/Clans/CombatantsHelper.sol:CombatantsHelper:via-ir")
    );
    combatantsHelper = CombatantsHelper(
      _deployUUPS(
        address(implementation),
        abi.encodeCall(
          implementation.initialize,
          (
            IPlayers(address(players)),
            IClans(address(clans)),
            ICombatants(address(territories)),
            ICombatants(address(lockedVaults)),
            ICombatants(address(raids)),
            AdminAccess(_deployAdminAccess(_addresses(address(this)), new address[](0))),
            true
          )
        )
      )
    );
  }

  function testAssignBothTerritoryAndLockedVaultCombatants() public {
    _evolveBothPlayers();

    _assign(true, _ids(OTHER_PLAYER_ID), true, _ids(PLAYER_ID));

    assertTrue(territories.isCombatant(CLAN_ID, OTHER_PLAYER_ID));
    assertTrue(lockedVaults.isCombatant(CLAN_ID, PLAYER_ID));
  }

  function testCannotAssignSamePlayerToBothFresh() public {
    vm.expectRevert(ICombatantsHelper.PlayerCannotBeInAssignedMoreThanOnce.selector);
    _assign(true, _ids(PLAYER_ID), true, _ids(PLAYER_ID));
  }

  function testCannotAssignSamePlayerAfterAssigningTerritoryFirst() public {
    players.setEvolved(PLAYER_ID, true);
    _assign(true, _ids(PLAYER_ID), false, _ids());

    vm.expectRevert(ICombatantsHelper.PlayerAlreadyExistingCombatant.selector);
    _assign(false, _ids(), true, _ids(PLAYER_ID));
  }

  function testCannotAssignSamePlayerAfterAssigningLockedVaultFirst() public {
    players.setEvolved(PLAYER_ID, true);
    _assign(false, _ids(), true, _ids(PLAYER_ID));

    vm.expectRevert(ICombatantsHelper.PlayerAlreadyExistingCombatant.selector);
    _assign(true, _ids(PLAYER_ID), false, _ids());
  }

  function testAssigningZeroCombatantsIsOk() public {
    _assign(true, _ids(), true, _ids());

    assertFalse(territories.isCombatant(CLAN_ID, PLAYER_ID));
    assertFalse(lockedVaults.isCombatant(CLAN_ID, PLAYER_ID));
  }

  function testAssigningZeroTerritoryCombatantsWhileLockedVaultsAreSet() public {
    players.setEvolved(PLAYER_ID, true);

    _assign(true, _ids(), true, _ids(PLAYER_ID));

    assertFalse(territories.isCombatant(CLAN_ID, PLAYER_ID));
    assertTrue(lockedVaults.isCombatant(CLAN_ID, PLAYER_ID));
  }

  function testAssigningZeroLockedVaultCombatantsWhileTerritoriesAreSet() public {
    players.setEvolved(PLAYER_ID, true);

    _assign(true, _ids(PLAYER_ID), true, _ids());

    assertTrue(territories.isCombatant(CLAN_ID, PLAYER_ID));
    assertFalse(lockedVaults.isCombatant(CLAN_ID, PLAYER_ID));
  }

  function testAssigningUnevolvedCombatantsRevertsForEveryCombatantType() public {
    vm.expectRevert(abi.encodeWithSelector(ICombatantsHelper.PlayerNotUpgraded.selector, PLAYER_ID));
    _assign(true, _ids(PLAYER_ID), false, _ids());

    vm.expectRevert(abi.encodeWithSelector(ICombatantsHelper.PlayerNotUpgraded.selector, PLAYER_ID));
    _assign(false, _ids(), true, _ids(PLAYER_ID));

    vm.expectRevert(abi.encodeWithSelector(ICombatantsHelper.PlayerNotUpgraded.selector, PLAYER_ID));
    vm.prank(ALICE);
    combatantsHelper.assignCombatants(CLAN_ID, false, _ids(), false, _ids(), true, _ids(PLAYER_ID), PLAYER_ID);
  }

  function testAssigningZeroAfterHavingSomeSetWhileOtherIsStillSet() public {
    _evolveBothPlayers();
    _assign(true, _ids(OTHER_PLAYER_ID), true, _ids(PLAYER_ID));

    combatantsHelper.clearCooldowns(_ids(OTHER_PLAYER_ID));
    _assign(true, _ids(OTHER_PLAYER_ID), true, _ids());

    assertTrue(territories.isCombatant(CLAN_ID, OTHER_PLAYER_ID));
    assertFalse(lockedVaults.isCombatant(CLAN_ID, PLAYER_ID));
  }

  function _assign(
    bool setTerritories,
    uint64[] memory territoryPlayerIds,
    bool setVaults,
    uint64[] memory vaultPlayerIds
  ) private {
    vm.prank(ALICE);
    combatantsHelper.assignCombatants(
      CLAN_ID,
      setTerritories,
      territoryPlayerIds,
      setVaults,
      vaultPlayerIds,
      false,
      _ids(),
      PLAYER_ID
    );
  }

  function _evolveBothPlayers() private {
    players.setEvolved(PLAYER_ID, true);
    players.setEvolved(OTHER_PLAYER_ID, true);
  }

  function _ids() private pure returns (uint64[] memory values) {
    values = new uint64[](0);
  }

  function _ids(uint64 playerId) private pure returns (uint64[] memory values) {
    values = new uint64[](1);
    values[0] = playerId;
  }
}
