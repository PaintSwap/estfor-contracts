// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {BankFactory} from "./BankFactory.sol";
import {Bank} from "./Bank.sol";
import {Clans} from "./Clans.sol";

import {PlayerNFT} from "../PlayerNFT.sol";

import {BulkTransferInfo} from "../globals/items.sol";

contract BankRelay is UUPSUpgradeable, OwnableUpgradeable {
  Clans private _clans;
  BankFactory private _bankFactory;
  PlayerNFT private _playerNFT;

  error PlayerNotInClan();

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address clans) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _clans = Clans(clans);
  }

  function depositItems(uint256 playerId, uint256[] calldata ids, uint256[] calldata amounts) external {
    _getBank(_getClanIdFromPlayer(playerId)).depositItems(_msgSender(), playerId, ids, amounts);
  }

  function withdrawItems(address to, uint256 playerId, uint256[] calldata ids, uint256[] calldata amounts) external {
    _getBank(_getClanIdFromPlayer(playerId)).withdrawItems(_msgSender(), to, playerId, ids, amounts);
  }

  function withdrawItemsBulk(BulkTransferInfo[] calldata nftsInfo, uint256 playerId) external {
    _getBank(_getClanIdFromPlayer(playerId)).withdrawItemsBulk(_msgSender(), nftsInfo, playerId);
  }

  function depositFTM(uint256 playerId) external payable {
    _getBank(_getClanIdFromPlayer(playerId)).depositFTM{value: msg.value}(_msgSender(), playerId);
  }

  function depositToken(uint256 playerId, address token, uint256 amount) external {
    _getBank(_getClanIdFromPlayer(playerId)).depositToken(_msgSender(), _msgSender(), playerId, token, amount);
  }

  function depositTokenFor(address playerOwner, uint256 playerId, address token, uint256 amount) external {
    _getBank(_getClanIdFromPlayer(playerId)).depositToken(_msgSender(), playerOwner, playerId, token, amount);
  }

  function withdrawToken(uint256 playerId, address to, uint256 toPlayerId, address token, uint256 amount) external {
    _getBank(_getClanIdFromPlayer(playerId)).withdrawToken(_msgSender(), playerId, to, toPlayerId, token, amount);
  }

  function withdrawTokenToMany(
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata amounts
  ) external {
    _getBank(_getClanIdFromPlayer(playerId)).withdrawTokenToMany(
      _msgSender(),
      playerId,
      tos,
      toPlayerIds,
      token,
      amounts
    );
  }

  function withdrawNFT(
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) external {
    _getBank(_getClanIdFromPlayer(playerId)).withdrawNFT(_msgSender(), playerId, to, toPlayerId, nft, tokenId, amount);
  }

  function withdrawFTM(address to, uint256 playerId, uint256 amount) external {
    _getBank(_getClanIdFromPlayer(playerId)).withdrawFTM(_msgSender(), to, playerId, amount);
  }

  function _getBank(uint256 clanId) private view returns (Bank) {
    return Bank(payable(_bankFactory.getBankAddress(clanId)));
  }

  function _getClanIdFromPlayer(uint256 playerId) private view returns (uint256) {
    uint clanId = _clans.getClanIdFromPlayer(playerId);
    require(clanId != 0, PlayerNotInClan());
    return clanId;
  }

  function getUniqueItemCountForPlayer(uint256 playerId) external view returns (uint256) {
    return _getBank(_getClanIdFromPlayer(playerId)).getUniqueItemCount();
  }

  function getUniqueItemCountForClan(uint256 clanId) external view returns (uint256) {
    return _getBank(clanId).getUniqueItemCount();
  }

  function setBankFactory(address bankFactory) external onlyOwner {
    _bankFactory = BankFactory(bankFactory);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
