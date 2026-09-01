// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/globals/actions.sol";
import "../../contracts/globals/clans.sol";
import "../../contracts/globals/items.sol";
import "../../contracts/globals/misc.sol";
import "../../contracts/globals/pets.sol";
import "../../contracts/globals/players.sol";
import "../../contracts/globals/promotions.sol";
import "../../contracts/globals/quests.sol";
import "../../contracts/globals/rewards.sol";

interface BankRelay {
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
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
    function depositTokenAtBank(address payable clanBankAddress, uint256 playerId, address token, uint256 amount)
        external;
    function depositTokenFor(address playerOwner, uint256 playerId, address token, uint256 amount) external;
    function depositTokenForAtBank(
        address payable clanBankAddress,
        address playerOwner,
        uint256 playerId,
        address token,
        uint256 amount
    ) external;
    function getUniqueItemCountAtBank(address payable bankAddress) external view returns (uint256);
    function getUniqueItemCountForClan(uint256 clanId) external view returns (uint256);
    function getUniqueItemCountForPlayer(uint256 playerId) external view returns (uint256);
    function initialize(address clans) external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function setBankFactory(address bankFactory) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
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
    function withdrawNFT(uint256 playerId, address to, uint256 toPlayerId, address nft, uint256 tokenId, uint256 amount)
        external;
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
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidInitialization();
    error NotInitializing();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PlayerNotInClan();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
