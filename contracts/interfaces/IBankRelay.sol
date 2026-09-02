// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BulkTransferInfo} from "../globals/items.sol";

interface IBankRelay {
  error PlayerNotInClan();

  function initialize(address clans) external;
  function depositFTM(uint256 playerId) external payable;
  function depositFTMAtBank(address payable clanBankAddress, uint256 playerId) external payable;
  function depositItems(uint256 playerId, uint256[] calldata ids, uint256[] calldata amounts) external;
  function depositItemsAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external;
  function depositToken(uint256 playerId, address token, uint256 amount) external;
  function depositTokenAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    address token,
    uint256 amount
  ) external;
  function depositTokenFor(address playerOwner, uint256 playerId, address token, uint256 amount) external;
  function depositTokenForAtBank(
    address payable clanBankAddress,
    address playerOwner,
    uint256 playerId,
    address token,
    uint256 amount
  ) external;
  function withdrawFTM(address to, uint256 playerId, uint256 amount) external;
  function withdrawFTMAtBank(address payable clanBankAddress, address to, uint256 playerId, uint256 amount) external;
  function withdrawItems(address to, uint256 playerId, uint256[] calldata ids, uint256[] calldata amounts) external;
  function withdrawItemsAtBank(
    address payable clanBankAddress,
    address to,
    uint256 playerId,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external;
  function withdrawItemsBulk(BulkTransferInfo[] calldata nftsInfo, uint256 playerId) external;
  function withdrawItemsBulkAtBank(
    address payable clanBankAddress,
    BulkTransferInfo[] calldata nftsInfo,
    uint256 playerId
  ) external;
  function withdrawNFT(
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) external;
  function withdrawNFTAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address nft,
    uint256 tokenId,
    uint256 amount
  ) external;
  function withdrawToken(uint256 playerId, address to, uint256 toPlayerId, address token, uint256 amount) external;
  function withdrawTokenAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    address to,
    uint256 toPlayerId,
    address token,
    uint256 amount
  ) external;
  function withdrawTokenToMany(
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata amounts
  ) external;
  function withdrawTokenToManyAtBank(
    address payable clanBankAddress,
    uint256 playerId,
    address[] calldata tos,
    uint256[] calldata toPlayerIds,
    address token,
    uint256[] calldata amounts
  ) external;
  function getUniqueItemCountAtBank(address payable bankAddress) external view returns (uint256);
  function getUniqueItemCountForClan(uint256 clanId) external view returns (uint256);
  function getUniqueItemCountForPlayer(uint256 playerId) external view returns (uint256);
  function setBankFactory(address bankFactory) external;
}
