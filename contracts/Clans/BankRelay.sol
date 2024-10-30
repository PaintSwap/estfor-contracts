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
    depositItems(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, ids, amounts);
  }

  function depositItems(
    address payable clanBankAddress,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) public {
    Bank(clanBankAddress).depositItems(_msgSender(), playerId, ids, amounts);
  }

  function withdrawItems(address to, uint256 playerId, uint256[] calldata ids, uint256[] calldata amounts) external {
    withdrawItems(_getBankAddress(_getClanIdFromPlayer(playerId)), to, playerId, ids, amounts);
  }

  function withdrawItems(
    address payable clanBankAddress,
    address to,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) public {
    Bank(clanBankAddress).withdrawItems(_msgSender(), to, playerId, ids, amounts);
  }

  function withdrawItemsBulk(BulkTransferInfo[] calldata nftsInfo, uint256 playerId) external {
    withdrawItemsBulk(_getBankAddress(_getClanIdFromPlayer(playerId)), nftsInfo, playerId);
  }

  function withdrawItemsBulk(
    address payable clanBankAddress,
    BulkTransferInfo[] calldata nftsInfo,
    uint256 playerId
  ) public {
    Bank(clanBankAddress).withdrawItemsBulk(_msgSender(), nftsInfo, playerId);
  }

  function depositFTM(uint256 playerId) external payable {
    depositFTM(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId);
  }

  function depositFTM(address payable clanBankAddress, uint256 playerId) public payable {
    Bank(clanBankAddress).depositFTM{value: msg.value}(_msgSender(), playerId);
  }

  function depositToken(uint256 playerId, address token, uint256 amount) external {
    depositToken(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, token, amount);
  }

  function depositToken(address payable clanBankAddress, uint256 playerId, address token, uint256 amount) public {
    Bank(clanBankAddress).depositToken(_msgSender(), _msgSender(), playerId, token, amount);
  }

  function depositTokenFor(address playerOwner, uint256 playerId, address token, uint256 amount) external {
    depositTokenFor(_getBankAddress(_getClanIdFromPlayer(playerId)), playerOwner, playerId, token, amount);
  }

  function depositTokenFor(
    address payable clanBankAddress,
    address playerOwner,
    uint256 playerId,
    address token,
    uint256 amount
  ) public {
    Bank(clanBankAddress).depositToken(_msgSender(), playerOwner, playerId, token, amount);
  }

  function withdrawToken(uint256 playerId, address to, uint256 toPlayerId, address token, uint256 amount) external {
    withdrawToken(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, to, toPlayerId, token, amount);
  }

  function withdrawToken(
    address payable clanBankAddress,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address token,
    uint256 amount
  ) public {
    Bank(clanBankAddress).withdrawToken(_msgSender(), playerId, to, toPlayerId, token, amount);
  }

  function withdrawTokenToMany(
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata amounts
  ) external {
    withdrawTokenToMany(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, tos, toPlayerIds, token, amounts);
  }

  function withdrawTokenToMany(
    address payable clanBankAddress,
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata amounts
  ) public {
    Bank(clanBankAddress).withdrawTokenToMany(_msgSender(), playerId, tos, toPlayerIds, token, amounts);
  }

  function withdrawNFT(
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) external {
    withdrawNFT(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, to, toPlayerId, nft, tokenId, amount);
  }

  function withdrawNFT(
    address payable clanBankAddress,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) public {
    Bank(clanBankAddress).withdrawNFT(_msgSender(), playerId, to, toPlayerId, nft, tokenId, amount);
  }

  function withdrawFTM(address to, uint256 playerId, uint256 amount) external {
    withdrawFTM(_getBankAddress(_getClanIdFromPlayer(playerId)), to, playerId, amount);
  }

  function withdrawFTM(address payable clanBankAddress, address to, uint256 playerId, uint256 amount) public {
    Bank(clanBankAddress).withdrawFTM(_msgSender(), to, playerId, amount);
  }

  function _getBankAddress(uint256 clanId) private view returns (address payable) {
    return payable(_bankFactory.getBankAddress(clanId));
  }

  function _getClanIdFromPlayer(uint256 playerId) private view returns (uint256) {
    uint clanId = _clans.getClanIdFromPlayer(playerId);
    require(clanId != 0, PlayerNotInClan());
    return clanId;
  }

  function getUniqueItemCountForPlayer(uint256 playerId) external view returns (uint256) {
    return Bank(_getBankAddress(_getClanIdFromPlayer(playerId))).getUniqueItemCount();
  }

  function getUniqueItemCountForClan(uint256 clanId) external view returns (uint256) {
    return Bank(_getBankAddress(clanId)).getUniqueItemCount();
  }

  function getUniqueItemCountForBank(address payable bankAddress) external view returns (uint256) {
    return Bank(bankAddress).getUniqueItemCount();
  }

  function setBankFactory(address bankFactory) external onlyOwner {
    _bankFactory = BankFactory(bankFactory);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
