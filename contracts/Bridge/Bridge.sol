// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {OAppUpgradeable, Origin, MessagingFee} from "@layerzerolabs/oapp-evm-upgradeable/contracts/oapp/OAppUpgradeable.sol";

import {PetNFT, Pet} from "../PetNFT.sol";

import {Skill} from "../globals/players.sol";

contract Bridge is OAppUpgradeable {
  struct Message {
    string message;
    uint40 timestamp;
  }

  struct SenderInfo {
    uint64 nonce;
    bool isAuthorized;
  }

  event UpdateAllowedSenders(uint32 indexed eid, address[] senders, bool[] isAuthorized);

  error InvalidOrigin(uint32 srcEid);
  error InvalidNonce(uint64 nonce);
  error InvalidInputLength();

  mapping(uint32 eid => mapping(bytes32 sender => SenderInfo info)) private _senderInfoByEID;
  mapping(uint32 => address[]) private _senders; // senders by EID

  PetNFT private _petNFT;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address lzEndpoint) OAppUpgradeable(lzEndpoint) {}

  function initialize(address delegate, address petNFT) public initializer {
    __OApp_init(delegate);
    __Ownable_init(_msgSender());
    _petNFT = PetNFT(petNFT);
  }

  /**
   * @notice Sends a message from the source to destination chain.
   * @param dstEid Destination chain's endpoint ID.
   * @param tokenType The type of token to send.
   * @param tokenId The message to send.
   * @param options Message execution options (e.g., for sending gas to destination).
   */
  function send(uint32 dstEid, uint8 tokenType, uint256 tokenId, bytes calldata options) external payable {
    bytes memory payload;
    if (tokenType == 0) {
      // Pet
      payload = abi.encode(tokenType, _petNFT.getBridgeableBytes(tokenId));
    } else {
      revert("Unknown token type");
    }

    _lzSend(
      dstEid,
      payload,
      options,
      // Fee in native gas and ZRO token.
      MessagingFee(msg.value, 0),
      // Refund address in case of failed source message.
      payable(_msgSender())
    );
  }

  // struct BasePetMetadata {
  //   string description;
  //   uint8 tier;
  //   PetSkin skin; // uint8
  //   PetEnhancementType enhancementType; // uint8
  //   Skill skillEnhancement1; // uint8
  //   uint8 skillFixedMin1;
  //   uint8 skillFixedMax1;
  //   uint8 skillFixedIncrement1;
  //   uint8 skillPercentageMin1;
  //   uint8 skillPercentageMax1;
  //   uint8 skillPercentageIncrement1;
  //   uint8 skillMinLevel1;
  //   Skill skillEnhancement2;
  //   uint8 skillFixedMin2;
  //   uint8 skillFixedMax2;
  //   uint8 skillFixedIncrement2;
  //   uint8 skillPercentageMin2;
  //   uint8 skillPercentageMax2;
  //   uint8 skillPercentageIncrement2;
  //   uint8 skillMinLevel2;
  //   uint16 fixedStarThreshold;
  //   uint16 percentageStarThreshold;
  // }

  // struct Pet {
  //   Skill skillEnhancement1; // uint8
  //   uint8 skillFixedEnhancement1;
  //   uint8 skillPercentageEnhancement1;
  //   Skill skillEnhancement2; // uint8
  //   uint8 skillFixedEnhancement2;
  //   uint8 skillPercentageEnhancement2;
  //   uint40 lastAssignmentTimestamp;
  //   address owner; // uint160
  //   // 1 byte left in this storage slot
  //   uint24 baseId;
  // }
  // string name;
  // uint40 lastAssignmentTimestamp;

  // // mapping(uint256 basePetId => BasePetMetadata metadata) private _basePetMetadatas;
  // // mapping(uint256 petId => Pet pet) private _pets;
  // // mapping(uint256 petId => string name) private _names;
  // // mapping(string name => bool exists) private _lowercaseNames;
  // // mapping(uint256 petId => uint40 lastAssignmentTimestamp) private _lastAssignmentTimestamps;

  /**
   * @dev Called when data is received from the protocol. It overrides the equivalent function in the parent contract.
   * Protocol messages are defined as packets, comprised of the following parameters.
   * @param origin A struct containing information about where the packet came from.
   * @param guid A global unique identifier for tracking the packet.
   * @param payload Encoded message.
   */
  function _lzReceive(
    Origin calldata origin,
    bytes32 guid,
    bytes calldata payload,
    address, // Executor address as specified by the OApp.
    bytes calldata // Any extra data or options to trigger on receipt.
  ) internal override {
    // Check if the payload is from the expected endpoint
    require(origin.srcEid == 5, InvalidOrigin(origin.srcEid));
    // Check if the sender is authorized and the nonce is valid
    require(_senderInfoByEID[origin.srcEid][origin.sender].isAuthorized, InvalidOrigin(origin.srcEid));
    // Check if the nonce is valid
    require(_senderInfoByEID[origin.srcEid][origin.sender].nonce < origin.nonce, InvalidNonce(origin.nonce));
    // Update nonce
    _senderInfoByEID[origin.srcEid][origin.sender].nonce = origin.nonce;

    // Determine the type from the first byte of the payload
    uint8 messageType = uint8(payload[0]);

    if (messageType == 0) {
      _handlePetMessage(payload);
      // } else if (messageType == 1) {
      //   _handleItemMessage(payload);
      // } else if (messageType == 2) {
      //   _handlePlayerMessage(payload);
    } else {
      revert("Unknown message type");
    }

    // Decode the payload to get the message
    (string memory message, uint40 timestamp) = abi.decode(payload, (string, uint40));

    // Some arbitrary data you want to deliver to the destination chain!
    Message memory data = Message(message, timestamp);
  }

  function _handlePetMessage(bytes calldata payload) private {
    // Decode the payload to get the message
    (string memory message, uint40 timestamp) = abi.decode(payload, (string, uint40));
    // Do something with the message
  }

  /**
   * @dev Set the allowed senders for a specific network endpoint ID.
   * @param eid The network endpoint ID.
   * @param senders The list of senders.
   * @param isAuthorized The list of authorization statuses.
   */
  function updateAllowedSenders(
    uint32 eid,
    address[] calldata senders,
    bool[] calldata isAuthorized
  ) external onlyOwner {
    require(senders.length == isAuthorized.length, InvalidInputLength());
    for (uint256 i = 0; i < senders.length; i++) {
      _senderInfoByEID[eid][bytes32(uint256(uint160(senders[i])))].isAuthorized = isAuthorized[i];
    }
    emit UpdateAllowedSenders(eid, senders, isAuthorized);
  }
}
