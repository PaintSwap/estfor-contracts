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
  error PlayerNotInClan();

  Clans private _clans;
  BankFactory private _bankFactory;
  PlayerNFT private _playerNFT;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address clans) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    _clans = Clans(clans);
  }

  /**
   * @notice Deposits items to the clan bank. The bank address is derived from the player's clan id.
   * @param playerId The ID of the player depositing items.
   * @param ids The array of item IDs to deposit.
   * @param amounts The array of item quantities to deposit.
   */
  function depositItems(uint256 playerId, uint256[] calldata ids, uint256[] calldata amounts) external {
    depositItemsAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, ids, amounts);
  }

  /**
   * @notice Deposits items to a specified clan bank address.
   * @param clanBankAddress The address of the clan bank.
   * @param playerId The ID of the player depositing items.
   * @param ids The array of item IDs to deposit.
   * @param amounts The array of item quantities to deposit.
   */
  function depositItemsAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) public {
    Bank(clanBankAddress).depositItems(_msgSender(), playerId, ids, amounts);
  }

  /**
   * @notice Withdraws items from the clan bank in bulk. Looks up the bank address from the player's clan id.
   * @param to The address to receive the items.
   * @param playerId The ID of the player withdrawing items.
   * @param ids The array of item IDs to withdraw.
   * @param amounts The array of item quantities to withdraw.
   */
  function withdrawItems(address to, uint256 playerId, uint256[] calldata ids, uint256[] calldata amounts) external {
    withdrawItemsAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), to, playerId, ids, amounts);
  }

  /**
   * @notice Withdraws items from a specified clan bank address in bulk.
   * @param clanBankAddress The address of the clan bank.
   * @param to The address to receive the items.
   * @param playerId The ID of the player withdrawing items.
   * @param ids The array of item IDs to withdraw.
   * @param amounts The array of item quantities to withdraw.
   */
  function withdrawItemsAtBank(
    address payable clanBankAddress,
    address to,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) public {
    Bank(clanBankAddress).withdrawItems(_msgSender(), to, playerId, ids, amounts);
  }

  /**
   * @notice Withdraws multiple items from the bank in bulk for a player. Bank address is derived from the player's clan id.
   * @param nftsInfo The items to withdraw in bulk.
   * @param playerId The ID of the player withdrawing items.
   */
  function withdrawItemsBulk(BulkTransferInfo[] calldata nftsInfo, uint256 playerId) external {
    withdrawItemsBulkAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), nftsInfo, playerId);
  }

  /**
   * @notice Withdraws multiple items from a specified bank in bulk for a player.
   * @param clanBankAddress The address of the clan bank.
   * @param nftsInfo The items to withdraw in bulk.
   * @param playerId The ID of the player withdrawing items.
   */
  function withdrawItemsBulkAtBank(
    address payable clanBankAddress,
    BulkTransferInfo[] calldata nftsInfo,
    uint256 playerId
  ) public {
    Bank(clanBankAddress).withdrawItemsBulk(_msgSender(), nftsInfo, playerId);
  }

  /**
   * @notice Deposits FTM to the clan bank. The bank address is derived from the player's clan id.
   * @param playerId The ID of the player depositing FTM.
   */
  function depositFTM(uint256 playerId) external payable {
    depositFTMAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId);
  }

  /**
   * @notice Deposits FTM to a specified clan bank address.
   * @param clanBankAddress The address of the clan bank.
   * @param playerId The ID of the player depositing FTM.
   */
  function depositFTMAtBank(address payable clanBankAddress, uint256 playerId) public payable {
    Bank(clanBankAddress).depositFTM{value: msg.value}(_msgSender(), playerId);
  }

  /**
   * @notice Deposits a specified amount of tokens to the clan bank for a player. Looks up the bank address from the player's clan id.
   * @param playerId The ID of the player depositing tokens.
   * @param token The address of the token being deposited.
   * @param amount The amount of tokens to deposit.
   */
  function depositToken(uint256 playerId, address token, uint256 amount) external {
    depositTokenAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, token, amount);
  }

  /**
   * @notice Deposits a specified amount of tokens to a specified clan bank address for a player.
   * @param clanBankAddress The address of the clan bank.
   * @param playerId The ID of the player depositing tokens.
   * @param token The address of the token being deposited.
   * @param amount The amount of tokens to deposit.
   */
  function depositTokenAtBank(address payable clanBankAddress, uint256 playerId, address token, uint256 amount) public {
    Bank(clanBankAddress).depositToken(_msgSender(), _msgSender(), playerId, token, amount);
  }

  /**
   * @notice Deposit an amount of a token to the clan bank for a player. Looks up the bank address from the player's clan id.
   * @param playerOwner The player owner address
   * @param playerId The player id
   * @param token The token address
   * @param amount The amount to deposit
   */
  function depositTokenFor(address playerOwner, uint256 playerId, address token, uint256 amount) external {
    depositTokenForAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), playerOwner, playerId, token, amount);
  }

  /**
   * @notice Deposit an amount of a token to the clan bank for a player.
   * @param clanBankAddress The bank address
   * @param playerOwner The player owner address
   * @param playerId The player id
   * @param token The token address
   * @param amount The amount to deposit
   */
  function depositTokenForAtBank(
    address payable clanBankAddress,
    address playerOwner,
    uint256 playerId,
    address token,
    uint256 amount
  ) public {
    Bank(clanBankAddress).depositToken(_msgSender(), playerOwner, playerId, token, amount);
  }

  /**
   * @notice Withdraw an amount of a token from the clan bank. Looks up the bank address from the player's clan id.
   * @param playerId The player id
   * @param to The address to withdraw to
   * @param toPlayerId The player id to withdraw to
   * @param token The token address
   * @param amount The amount to withdraw
   */
  function withdrawToken(uint256 playerId, address to, uint256 toPlayerId, address token, uint256 amount) external {
    withdrawTokenAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, to, toPlayerId, token, amount);
  }

  /**
   * @notice Withdraw an amount of a token from the clan bank.
   * @param clanBankAddress The bank address
   * @param playerId The player id
   * @param to The address to withdraw to
   * @param toPlayerId The player id to withdraw to
   * @param token The token address
   * @param amount The amount to withdraw
   */
  function withdrawTokenAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address token,
    uint256 amount
  ) public {
    Bank(clanBankAddress).withdrawToken(_msgSender(), playerId, to, toPlayerId, token, amount);
  }

  /**
   * @notice Withdraws an amount of tokens from the clan bank for a player, transferring to many other players.
   * Looks up the bank address from the player's clan id.
   * @param playerId The ID of the player withdrawing tokens.
   * @param tos Array of addresses to receive the tokens.
   * @param toPlayerIds Array of player IDs to receive tokens.
   * @param token The address of the token being withdrawn.
   * @param amounts Array of token amounts to withdraw.
   */
  function withdrawTokenToMany(
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata amounts
  ) external {
    withdrawTokenToManyAtBank(
      _getBankAddress(_getClanIdFromPlayer(playerId)),
      playerId,
      tos,
      toPlayerIds,
      token,
      amounts
    );
  }

  /**
   * @notice Withdraw an amount of a token from the clan bank for a player to many other players.
   * @param clanBankAddress The bank address
   * @param playerId The player id
   * @param tos The addresses to withdraw to
   * @param toPlayerIds The player ids to withdraw to
   * @param token The token address
   * @param amounts The amounts to withdraw
   */
  function withdrawTokenToManyAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata amounts
  ) public {
    Bank(clanBankAddress).withdrawTokenToMany(_msgSender(), playerId, tos, toPlayerIds, token, amounts);
  }

  /**
   * @notice Withdraws an NFT from the clan bank for a player. Looks up the bank address from the player's clan id.
   * @param playerId The ID of the player withdrawing the NFT.
   * @param to The address to receive the NFT.
   * @param toPlayerId The player ID to receive the NFT.
   * @param nft The address of the NFT contract.
   * @param tokenId The ID of the NFT token.
   * @param amount The quantity of the NFT to withdraw.
   */
  function withdrawNFT(
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) external {
    withdrawNFTAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), playerId, to, toPlayerId, nft, tokenId, amount);
  }

  /**
   * @notice Withdraws an NFT from a specified clan bank for a player.
   * @param clanBankAddress The address of the clan bank.
   * @param playerId The ID of the player withdrawing the NFT.
   * @param to The address to receive the NFT.
   * @param toPlayerId The player ID to receive the NFT.
   * @param nft The address of the NFT contract.
   * @param tokenId The ID of the NFT token.
   * @param amount The quantity of the NFT to withdraw.
   */
  function withdrawNFTAtBank(
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

  /**
   * @notice Withdraw an amount of FTM from the clan bank. Looks up the bank address from the player's clan id.
   * @param to The address to withdraw to
   * @param playerId The player id
   * @param amount The amount to withdraw
   */
  function withdrawFTM(address to, uint256 playerId, uint256 amount) external {
    withdrawFTMAtBank(_getBankAddress(_getClanIdFromPlayer(playerId)), to, playerId, amount);
  }

  /**
   * @notice Withdraw an amount of FTM from the clan bank.
   * @param clanBankAddress The bank address
   * @param to The address to withdraw to
   * @param playerId The player id
   * @param amount The amount to withdraw
   */
  function withdrawFTMAtBank(address payable clanBankAddress, address to, uint256 playerId, uint256 amount) public {
    Bank(clanBankAddress).withdrawFTM(_msgSender(), to, playerId, amount);
  }

  function _getBankAddress(uint256 clanId) private view returns (address payable) {
    return payable(_bankFactory.getBankAddress(clanId));
  }

  function _getClanIdFromPlayer(uint256 playerId) private view returns (uint256) {
    uint256 clanId = _clans.getClanIdFromPlayer(playerId);
    require(clanId != 0, PlayerNotInClan());
    return clanId;
  }

  /**
   * @notice Gets the unique item count for a player. Looks up the bank address from the player's clan id.
   * @param playerId The ID of the player.
   * @return The unique item count.
   */
  function getUniqueItemCountForPlayer(uint256 playerId) external view returns (uint256) {
    return Bank(_getBankAddress(_getClanIdFromPlayer(playerId))).getUniqueItemCount();
  }

  /**
   * @notice Get the unique item count for a clan. Looks up the bank address from the clan id.
   * @param clanId The clan id
   * @return The unique item count
   */
  function getUniqueItemCountForClan(uint256 clanId) external view returns (uint256) {
    return Bank(_getBankAddress(clanId)).getUniqueItemCount();
  }

  /**
   * @notice Get the unique item count for a bank.
   * @param bankAddress The bank address
   * @return The unique item count
   */
  function getUniqueItemCountAtBank(address payable bankAddress) external view returns (uint256) {
    return Bank(bankAddress).getUniqueItemCount();
  }

  function setBankFactory(address bankFactory) external onlyOwner {
    _bankFactory = BankFactory(bankFactory);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
