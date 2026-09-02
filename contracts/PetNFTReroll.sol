// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {ItemNFT} from "./ItemNFT.sol";
import {IPetNFT} from "./interfaces/IPetNFT.sol";
import {IPetNFTReroll} from "./interfaces/IPetNFTReroll.sol";
import {Pet} from "./globals/pets.sol";
import {PET_SHARD} from "./globals/items.sol";

import {PaintswapVRFConsumerUpgradeable} from "@paintswap/vrf/contracts/PaintswapVRFConsumerUpgradeable.sol";

/// @custom:oz-upgrades-from PetNFTRerollV1
contract PetNFTReroll is UUPSUpgradeable, OwnableUpgradeable, PaintswapVRFConsumerUpgradeable, IPetNFTReroll {
  uint256 private constant CALLBACK_GAS_LIMIT_PER_ACTION = 180_000;
  address private constant DAO_MULTISIG_ADDRESS = 0xC7073F6317813C3EDB09FA2d19A6cA259A9d4aD9;

  struct PetRerollInfo {
    uint24 petBaseId;
    uint256 originalPetTokenId;
    address from;
  }

  ItemNFT private _itemNFT;
  IPetNFT private _petNFT;
  mapping(uint256 requestId => PetRerollInfo) private _requestIdToOwner;

  modifier isOwnerOfPet(uint256 petId) {
    require(_petNFT.ownerOf(petId) == _msgSender(), NotOwnerOfPet());
    _;
  }

  modifier isOwnerOfPetShard() {
    require(_itemNFT.balanceOf(_msgSender(), PET_SHARD) > 0, NotOwnerOfPetShard());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address owner,
    ItemNFT itemNFT,
    IPetNFT petNFT,
    address paintswapVRFConsumer
  ) external initializer {
    require(owner != address(0), InvalidAddress());
    require(address(itemNFT) != address(0), InvalidAddress());
    require(address(petNFT) != address(0), InvalidAddress());
    require(paintswapVRFConsumer != address(0), InvalidAddress());

    __UUPSUpgradeable_init();
    __Ownable_init(owner);
    __PaintswapVRFConsumerUpgradeable_init(paintswapVRFConsumer);

    _itemNFT = itemNFT;
    _petNFT = petNFT;
  }

  function rerollPet(uint256 petTokenId) external payable isOwnerOfPet(petTokenId) isOwnerOfPetShard {
    uint256 requestId = _requestRandomWords(1);
    Pet memory pet = _petNFT.getPet(petTokenId);

    _itemNFT.burn(_msgSender(), PET_SHARD, 1);
    _petNFT.burn(_msgSender(), petTokenId);
    _requestIdToOwner[requestId] = PetRerollInfo({
      petBaseId: pet.baseId,
      originalPetTokenId: petTokenId,
      from: _msgSender()
    });
    emit RequestPetReroll(_msgSender(), petTokenId, requestId);
  }

  function _requestRandomWords(uint256 numWords) private returns (uint256 requestId) {
    requestId = _requestRandomnessPayInNative(
      callbackGasLimitForRequests(numWords),
      numWords,
      DAO_MULTISIG_ADDRESS,
      msg.value
    );
  }

  function _fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    require(_requestIdToOwner[requestId].from != address(0), RequestDoesNotExist());
    require(randomWords.length != 0, NoRandomWords());

    PetRerollInfo memory rerollInfo = _requestIdToOwner[requestId];
    uint256[] memory basePetIds = new uint256[](1);
    basePetIds[0] = rerollInfo.petBaseId;

    uint256[] memory newPetTokenIds = _petNFT.mintBatch(rerollInfo.from, basePetIds, randomWords[0]);

    delete _requestIdToOwner[requestId];
    emit CompletePetReroll(rerollInfo.from, rerollInfo.originalPetTokenId, newPetTokenIds[0], requestId);
  }

  function callbackGasLimitForRequests(uint256 numActions) private pure returns (uint256 callbackGasLimit) {
    callbackGasLimit = CALLBACK_GAS_LIMIT_PER_ACTION * numActions;
    // Have both a minimum and maximum gas limit
    if (callbackGasLimit < 200_000) {
      callbackGasLimit = 200_000;
    } else if (callbackGasLimit > 6_500_000) {
      callbackGasLimit = 6_500_000;
    }
  }

  function requestCost(uint256 numActions) public view returns (uint256) {
    return _calculateRequestPriceNative(callbackGasLimitForRequests(numActions));
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
