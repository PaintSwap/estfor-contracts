// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {SkillLibrary} from "./libraries/SkillLibrary.sol";
import {IOracleCB} from "./interfaces/IOracleCB.sol";
import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";
import {IWorldActions} from "./interfaces/IWorldActions.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract RandomnessBeacon is UUPSUpgradeable, OwnableUpgradeable {
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;

  event RequestSent(uint256 requestId, uint256 numWords, uint256 lastRandomWordsUpdatedTime);
  event RequestFulfilled(uint256 requestId, uint256 randomWord);

  error RandomWordsCannotBeUpdatedYet();
  error CanOnlyRequestAfterTheNextCheckpoint(uint256 currentTime, uint256 checkpoint);
  error RequestAlreadyFulfilled();
  error NoValidRandomWord();
  error LengthMismatch();
  error CallbackGasLimitTooHigh();
  error CallerNotSamWitchVRF();
  error RandomWordsAlreadyInitialized();

  uint256 private constant NUM_WORDS = 1;
  uint256 public constant MIN_RANDOM_WORDS_UPDATE_TIME = 1 days;
  uint256 public constant NUM_DAYS_RANDOM_WORDS_INITIALIZED = 3;

  uint40 private _lastRandomWordsUpdatedTime;
  uint40 private _startTime;
  uint24 private _expectedGasLimitFulfill;
  ISamWitchVRF private _samWitchVRF;
  IOracleCB private _wishingWell;
  IOracleCB private _dailyRewardsScheduler;
  uint256 private _isRandomWordsInitialized; // Doesn't need to be packed with anything, only called on initialization

  uint256[] private _requestIds; // Each one is a set of random words for 1 day
  mapping(uint256 requestId => uint256 randomWord) private _randomWords;

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    require(_msgSender() == address(_samWitchVRF), CallerNotSamWitchVRF());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address vrf) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    uint40 startTime = uint40(
      (block.timestamp / MIN_RANDOM_WORDS_UPDATE_TIME) *
        MIN_RANDOM_WORDS_UPDATE_TIME -
        (NUM_DAYS_RANDOM_WORDS_INITIALIZED + 1) *
        1 days
    );
    _startTime = startTime; // Floor to the nearest day 00:00 UTC
    _lastRandomWordsUpdatedTime = uint40(startTime + NUM_DAYS_RANDOM_WORDS_INITIALIZED * 1 days);
    _expectedGasLimitFulfill = 600_000;
    _samWitchVRF = ISamWitchVRF(vrf);
  }

  function requestIds(uint256 requestId) external view returns (uint256) {
    return _requestIds[requestId];
  }

  function randomWords(uint256 requestId) external view returns (uint256) {
    return _randomWords[requestId];
  }

  function lastRandomWordsUpdatedTime() external view returns (uint256) {
    return _lastRandomWordsUpdatedTime;
  }

  function requestRandomWords() external returns (uint256 requestId) {
    // Last one has not been fulfilled yet
    require(
      _requestIds.length == 0 || _randomWords[_requestIds[_requestIds.length - 1]] != 0,
      RandomWordsCannotBeUpdatedYet()
    );
    uint40 newLastRandomWordsUpdatedTime = uint40(_lastRandomWordsUpdatedTime + MIN_RANDOM_WORDS_UPDATE_TIME);
    require(
      newLastRandomWordsUpdatedTime <= block.timestamp,
      CanOnlyRequestAfterTheNextCheckpoint(block.timestamp, newLastRandomWordsUpdatedTime)
    );

    requestId = uint256(_samWitchVRF.requestRandomWords(NUM_WORDS, _expectedGasLimitFulfill));
    _requestIds.push(requestId);
    _lastRandomWordsUpdatedTime = newLastRandomWordsUpdatedTime;
    emit RequestSent(requestId, NUM_WORDS, newLastRandomWordsUpdatedTime);
    return requestId;
  }

  function fulfillRandomWords(bytes32 requestId, uint256[] memory words) external onlySamWitchVRF {
    _fulfillRandomWords(uint256(requestId), words);
  }

  function _getRandomWordOffset(uint256 timestamp) private view returns (int) {
    if (timestamp < _startTime) {
      return -1;
    }
    return int((timestamp - _startTime) / MIN_RANDOM_WORDS_UPDATE_TIME);
  }

  function _getRandomWord(uint256 timestamp) private view returns (uint256) {
    int _offset = _getRandomWordOffset(timestamp);
    if (_offset < 0 || _requestIds.length <= uint256(_offset)) {
      return 0;
    }
    return _randomWords[_requestIds[uint256(_offset)]];
  }

  function hasRandomWord(uint256 timestamp) external view returns (bool) {
    return _getRandomWord(timestamp) != 0;
  }

  function getRandomWord(uint256 timestamp) public view returns (uint256 randomWord) {
    randomWord = _getRandomWord(timestamp);
    require(randomWord != 0, NoValidRandomWord());
  }

  function getMultipleWords(uint256 timestamp) public view returns (uint256[4] memory words) {
    for (uint256 i; i < 4; ++i) {
      words[i] = getRandomWord(timestamp - (i * 1 days));
    }
  }

  function getRandomBytes(
    uint256 numTickets,
    uint256 startTimestamp,
    uint256 endTimestamp,
    uint256 playerId
  ) external view returns (bytes memory randomBytes) {
    if (numTickets <= 16) {
      // 32 bytes
      bytes32 word = bytes32(getRandomWord(endTimestamp));
      randomBytes = abi.encodePacked(_getRandomComponent(word, startTimestamp, endTimestamp, playerId));
    } else if (numTickets <= MAX_UNIQUE_TICKETS) {
      // 4 * 32 bytes
      uint256[4] memory multipleWords = getMultipleWords(endTimestamp);
      for (uint256 i; i < 4; ++i) {
        multipleWords[i] = uint256(
          _getRandomComponent(bytes32(multipleWords[i]), startTimestamp, endTimestamp, playerId)
        );
        // XOR all the words with the first fresh random number to give more randomness to the existing random words
        if (i != 0) {
          multipleWords[i] = uint256(keccak256(abi.encodePacked(multipleWords[i] ^ multipleWords[0])));
        }
      }
      randomBytes = abi.encodePacked(multipleWords);
    } else {
      assert(false);
    }
  }

  function _getRandomComponent(
    bytes32 word,
    uint256 startTimestamp,
    uint256 endTimestamp,
    uint256 playerId
  ) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(word, startTimestamp, endTimestamp, playerId));
  }

  function _fulfillRandomWords(uint256 requestId, uint256[] memory fulfilledRandomWords) internal {
    require(_randomWords[requestId] == 0, RequestAlreadyFulfilled());
    require(fulfilledRandomWords.length == NUM_WORDS, LengthMismatch());

    uint256 randomWord = fulfilledRandomWords[0];
    _randomWords[requestId] = randomWord;
    _wishingWell.newOracleRandomWords(randomWord);
    _dailyRewardsScheduler.newOracleRandomWords(randomWord);
    emit RequestFulfilled(requestId, randomWord);
  }

  function initializeAddresses(IOracleCB wishingWell, IOracleCB dailyRewardsScheduler) external onlyOwner {
    _wishingWell = IOracleCB(wishingWell);
    _dailyRewardsScheduler = IOracleCB(dailyRewardsScheduler);
  }

  function initializeRandomWords() external onlyOwner {
    // Initialize a few days worth of random words so that we have enough data to fetch the first day
    require(_isRandomWordsInitialized == 0, RandomWordsAlreadyInitialized());
    _isRandomWordsInitialized = 1;
    for (uint256 i; i < NUM_DAYS_RANDOM_WORDS_INITIALIZED; ++i) {
      uint256 requestId = 200 + i;
      _requestIds.push(requestId);
      emit RequestSent(requestId, NUM_WORDS, _startTime + (i * 1 days) + 1 days);
      uint256[] memory words = new uint256[](1);
      words[0] = uint256(keccak256(abi.encodePacked(block.chainid == 31337 ? address(31337) : address(this), i)));
      _fulfillRandomWords(requestId, words);
    }
  }

  function setExpectedGasLimitFulfill(uint256 gasLimit) external onlyOwner {
    require(gasLimit <= 3_000_000, CallbackGasLimitTooHigh());
    _expectedGasLimitFulfill = uint24(gasLimit);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
