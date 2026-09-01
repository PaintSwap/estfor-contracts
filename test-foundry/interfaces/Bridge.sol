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

interface Bridge {
    struct Origin {
        uint32 srcEid;
        bytes32 sender;
        uint64 nonce;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function allowInitializePath(Bridge.Origin calldata origin) external view returns (bool);
    function endpoint() external view returns (address);
    function initialize(uint32 srcEid) external;
    function initializeAddresses(
        address petNFT,
        address itemNFT,
        address playerNFT,
        address players,
        address clans,
        address quests,
        address passiveActions
    ) external;
    function isComposeMsgSender(Bridge.Origin calldata arg0, bytes calldata arg1, address _sender)
        external
        view
        returns (bool);
    function lzReceive(
        Bridge.Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable;
    function nextNonce(uint32 arg0, bytes32 arg1) external view returns (uint64 nonce);
    function oAppVersion() external pure returns (uint64 senderVersion, uint64 receiverVersion);
    function owner() external view returns (address);
    function peers(uint32 _eid) external view returns (bytes32);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function setDelegate(address _delegate) external;
    function setPeer(uint32 _eid, bytes32 _peer) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PeerSet(uint32 eid, bytes32 peer);
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidDelegate();
    error InvalidEndpointCall();
    error InvalidInitialization();
    error InvalidInputLength();
    error InvalidSourceChain();
    error LzTokenUnavailable();
    error MessageAlreadyProcessed();
    error NoPeer(uint32 eid);
    error NotEnoughNative(uint256 msgValue);
    error NotInitializing();
    error OnlyEndpoint(address addr);
    error OnlyPeer(uint32 eid, bytes32 sender);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PlayerAlreadyExists();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error UnknownMessageType();
}
