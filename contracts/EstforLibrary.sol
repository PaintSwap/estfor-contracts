// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPlayers} from "./interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// This file contains methods for interacting with generic functions like trimming strings, lowercase etc.
// Also has some shared functions for rewards
library EstforLibrary {
  error RandomRewardsMustBeInOrder(uint16 chance1, uint16 chance2);
  error RandomRewardNoDuplicates();
  error GuaranteedRewardsNoDuplicates();
  error TooManyGuaranteedRewards();
  error TooManyRandomRewards();

  function isWhitespace(bytes1 _char) internal pure returns (bool) {
    return
      _char == 0x20 || // Space
      _char == 0x09 || // Tab
      _char == 0x0a || // Line feed
      _char == 0x0D || // Carriage return
      _char == 0x0B || // Vertical tab
      _char == 0x00; // empty byte
  }

  function leftTrim(string memory str) internal pure returns (string memory) {
    bytes memory b = bytes(str);
    uint256 strLen = b.length;
    uint256 start = type(uint256).max;
    // Find the index of the first non-whitespace character
    for (uint256 i = 0; i < strLen; ++i) {
      bytes1 char = b[i];
      if (!isWhitespace(char)) {
        start = i;
        break;
      }
    }

    if (start == type(uint256).max) {
      return "";
    }
    // Copy the remainder to a new string
    bytes memory trimmedBytes = new bytes(strLen - start);
    for (uint256 i = start; i < strLen; ++i) {
      trimmedBytes[i - start] = b[i];
    }
    return string(trimmedBytes);
  }

  function rightTrim(string calldata str) internal pure returns (string memory) {
    bytes memory b = bytes(str);
    uint256 strLen = b.length;
    if (strLen == 0) {
      return "";
    }
    int end = -1;
    // Find the index of the last non-whitespace character
    for (int i = int(strLen) - 1; i >= 0; --i) {
      bytes1 char = b[uint256(i)];
      if (!isWhitespace(char)) {
        end = i;
        break;
      }
    }

    if (end == -1) {
      return "";
    }

    bytes memory trimmedBytes = new bytes(uint256(end) + 1);
    for (uint256 i = 0; i <= uint256(end); ++i) {
      trimmedBytes[i] = b[i];
    }
    return string(trimmedBytes);
  }

  function trim(string calldata str) external pure returns (string memory) {
    return leftTrim(rightTrim(str));
  }

  // Assumes the string is already trimmed
  function containsValidNameCharacters(string calldata name) external pure returns (bool) {
    bytes memory b = bytes(name);
    bool lastCharIsWhitespace;
    for (uint256 i = 0; i < b.length; ++i) {
      bytes1 char = b[i];

      bool isUpperCaseLetter = (char >= 0x41) && (char <= 0x5A); // A-Z
      bool isLowerCaseLetter = (char >= 0x61) && (char <= 0x7A); // a-z
      bool isDigit = (char >= 0x30) && (char <= 0x39); // 0-9
      bool isSpecialCharacter = (char == 0x2D) || (char == 0x5F) || (char == 0x2E) || (char == 0x20); // "-", "_", ".", and " "
      bool _isWhitespace = isWhitespace(char);
      bool hasMultipleWhitespaceInRow = lastCharIsWhitespace && _isWhitespace;
      lastCharIsWhitespace = _isWhitespace;
      if ((!isUpperCaseLetter && !isLowerCaseLetter && !isDigit && !isSpecialCharacter) || hasMultipleWhitespaceInRow) {
        return false;
      }
    }
    return true;
  }

  function containsValidDiscordCharacters(string calldata discord) external pure returns (bool) {
    bytes memory discordBytes = bytes(discord);
    for (uint256 i = 0; i < discordBytes.length; ++i) {
      bytes1 char = discordBytes[i];

      bool isUpperCaseLetter = (char >= 0x41) && (char <= 0x5A); // A-Z
      bool isLowerCaseLetter = (char >= 0x61) && (char <= 0x7A); // a-z
      bool isDigit = (char >= 0x30) && (char <= 0x39); // 0-9
      if (!isUpperCaseLetter && !isLowerCaseLetter && !isDigit) {
        return false;
      }
    }

    return true;
  }

  function containsValidTelegramCharacters(string calldata telegram) external pure returns (bool) {
    bytes memory telegramBytes = bytes(telegram);
    for (uint256 i = 0; i < telegramBytes.length; ++i) {
      bytes1 char = telegramBytes[i];

      bool isUpperCaseLetter = (char >= 0x41) && (char <= 0x5A); // A-Z
      bool isLowerCaseLetter = (char >= 0x61) && (char <= 0x7A); // a-z
      bool isDigit = (char >= 0x30) && (char <= 0x39); // 0-9
      bool isPlus = char == 0x2B; // "+"
      if (!isUpperCaseLetter && !isLowerCaseLetter && !isDigit && !isPlus) {
        return false;
      }
    }

    return true;
  }

  function containsValidTwitterCharacters(string calldata twitter) external pure returns (bool) {
    bytes memory twitterBytes = bytes(twitter);
    for (uint256 i = 0; i < twitterBytes.length; ++i) {
      bytes1 char = twitterBytes[i];

      bool isUpperCaseLetter = (char >= 0x41) && (char <= 0x5A); // A-Z
      bool isLowerCaseLetter = (char >= 0x61) && (char <= 0x7A); // a-z
      bool isDigit = (char >= 0x30) && (char <= 0x39); // 0-9
      if (!isUpperCaseLetter && !isLowerCaseLetter && !isDigit) {
        return false;
      }
    }

    return true;
  }

  function containsBaselineSocialNameCharacters(string calldata socialMediaName) external pure returns (bool) {
    bytes memory socialMediaNameBytes = bytes(socialMediaName);
    for (uint256 i = 0; i < socialMediaNameBytes.length; ++i) {
      bytes1 char = socialMediaNameBytes[i];

      bool isUpperCaseLetter = (char >= 0x41) && (char <= 0x5A); // A-Z
      bool isLowerCaseLetter = (char >= 0x61) && (char <= 0x7A); // a-z
      bool isDigit = (char >= 0x30) && (char <= 0x39); // 0-9
      bool isUnderscore = char == 0x5F; // "_"
      bool isPeriod = char == 0x2E; // "."
      bool isPlus = char == 0x2B; // "+"
      if (!isUpperCaseLetter && !isLowerCaseLetter && !isDigit && !isUnderscore && !isPeriod && !isPlus) {
        return false;
      }
    }

    return true;
  }

  function toLower(string memory str) internal pure returns (string memory) {
    bytes memory lowerStr = abi.encodePacked(str);
    for (uint256 i = 0; i < lowerStr.length; ++i) {
      bytes1 char = lowerStr[i];
      if ((char >= 0x41) && (char <= 0x5A)) {
        // So we add 32 to make it lowercase
        lowerStr[i] = bytes1(uint8(char) + 32);
      }
    }
    return string(lowerStr);
  }

  // This should match the one below, useful when a calldata array is needed and for external testing
  function _binarySearchMemory(uint64[] calldata array, uint256 target) internal pure returns (uint256) {
    uint256 low = 0;
    uint256 high = array.length - 1;

    while (low <= high) {
      uint256 mid = low + (high - low) / 2;

      if (array[mid] == target) {
        return mid; // Element found
      } else if (array[mid] < target) {
        low = mid + 1;
      } else {
        // Check to prevent underflow
        if (mid != 0) {
          high = mid - 1;
        } else {
          // If mid is 0 and _arr[mid] is not the target, the element is not in the array
          break;
        }
      }
    }

    return type(uint256).max; // Element not found
  }

  function binarySearchMemory(uint64[] calldata array, uint256 target) external pure returns (uint256) {
    return _binarySearchMemory(array, target);
  }

  // This should match the one above
  function _binarySearch(uint64[] storage array, uint256 target) internal view returns (uint256) {
    uint256 low = 0;
    uint256 high = array.length - 1;

    while (low <= high) {
      uint256 mid = low + (high - low) / 2;

      if (array[mid] == target) {
        return mid; // Element found
      } else if (array[mid] < target) {
        low = mid + 1;
      } else {
        // Check to prevent underflow
        if (mid != 0) {
          high = mid - 1;
        } else {
          // If mid is 0 and _arr[mid] is not the target, the element is not in the array
          break;
        }
      }
    }

    return type(uint256).max; // Element not found
  }

  function binarySearch(uint64[] storage array, uint256 target) external view returns (uint256) {
    return _binarySearch(array, target);
  }

  function _shuffleArray(uint64[] memory array, uint256 randomNumber) internal pure returns (uint64[] memory output) {
    for (uint256 i; i < array.length; ++i) {
      uint256 n = i + (randomNumber % (array.length - i));
      if (i != n) {
        uint64 temp = array[n];
        array[n] = array[i];
        array[i] = temp;
      }
    }
    return array;
  }

  function _getRandomInRange16(
    uint256 randomWord,
    uint256 shift,
    int16 minValue,
    int16 maxValue
  ) internal pure returns (int16) {
    return int16(minValue + (int16(int256((randomWord >> shift) & 0xFFFF) % (maxValue - minValue + 1))));
  }

  function _getRandomFromArray16(
    uint256 randomWord,
    uint256 shift,
    uint16[] storage arr,
    uint256 arrLength
  ) internal view returns (uint16) {
    return arr[_getRandomIndexFromArray16(randomWord, shift, arrLength)];
  }

  function _getRandomFrom3ElementArray16(
    uint256 randomWord,
    uint256 shift,
    uint16[3] memory arr
  ) internal pure returns (uint16) {
    return arr[_getRandomIndexFromArray16(randomWord, shift, arr.length)];
  }

  function _getRandomIndexFromArray16(
    uint256 randomWord,
    uint256 shift,
    uint256 arrLength
  ) internal pure returns (uint16) {
    return uint16(((randomWord >> shift) & 0xFFFF) % arrLength);
  }

  function setActionGuaranteedRewards(
    GuaranteedReward[] calldata guaranteedRewards,
    ActionRewards storage actionRewards
  ) external {
    _setActionGuaranteedRewards(guaranteedRewards, actionRewards);
  }

  function setActionRandomRewards(RandomReward[] calldata randomRewards, ActionRewards storage actionRewards) external {
    _setActionRandomRewards(randomRewards, actionRewards);
  }

  function _setActionGuaranteedRewards(
    GuaranteedReward[] calldata guaranteedRewards,
    ActionRewards storage actionRewards
  ) internal {
    uint256 guaranteedRewardsLength = guaranteedRewards.length;
    if (guaranteedRewardsLength != 0) {
      actionRewards.guaranteedRewardTokenId1 = guaranteedRewards[0].itemTokenId;
      actionRewards.guaranteedRewardRate1 = guaranteedRewards[0].rate;
    }
    if (guaranteedRewardsLength > 1) {
      actionRewards.guaranteedRewardTokenId2 = guaranteedRewards[1].itemTokenId;
      actionRewards.guaranteedRewardRate2 = guaranteedRewards[1].rate;
      require(
        actionRewards.guaranteedRewardTokenId1 != actionRewards.guaranteedRewardTokenId2,
        GuaranteedRewardsNoDuplicates()
      );
    }
    if (guaranteedRewardsLength > 2) {
      actionRewards.guaranteedRewardTokenId3 = guaranteedRewards[2].itemTokenId;
      actionRewards.guaranteedRewardRate3 = guaranteedRewards[2].rate;

      uint256 bounds = guaranteedRewardsLength - 1;
      for (uint256 i; i < bounds; ++i) {
        require(
          guaranteedRewards[i].itemTokenId != guaranteedRewards[guaranteedRewardsLength - 1].itemTokenId,
          GuaranteedRewardsNoDuplicates()
        );
      }
    }
    require(guaranteedRewardsLength <= 3, TooManyGuaranteedRewards());
  }

  // Random rewards have most common one first
  function _setActionRandomRewards(
    RandomReward[] calldata randomRewards,
    ActionRewards storage actionRewards
  ) internal {
    uint256 randomRewardsLength = randomRewards.length;
    if (randomRewardsLength != 0) {
      actionRewards.randomRewardTokenId1 = randomRewards[0].itemTokenId;
      actionRewards.randomRewardChance1 = randomRewards[0].chance;
      actionRewards.randomRewardAmount1 = randomRewards[0].amount;
    }
    if (randomRewardsLength > 1) {
      actionRewards.randomRewardTokenId2 = randomRewards[1].itemTokenId;
      actionRewards.randomRewardChance2 = randomRewards[1].chance;
      actionRewards.randomRewardAmount2 = randomRewards[1].amount;

      require(
        actionRewards.randomRewardChance2 <= actionRewards.randomRewardChance1,
        RandomRewardsMustBeInOrder(randomRewards[0].chance, randomRewards[1].chance)
      );
      require(actionRewards.randomRewardTokenId1 != actionRewards.randomRewardTokenId2, RandomRewardNoDuplicates());
    }
    if (randomRewardsLength > 2) {
      actionRewards.randomRewardTokenId3 = randomRewards[2].itemTokenId;
      actionRewards.randomRewardChance3 = randomRewards[2].chance;
      actionRewards.randomRewardAmount3 = randomRewards[2].amount;

      require(
        actionRewards.randomRewardChance3 <= actionRewards.randomRewardChance2,
        RandomRewardsMustBeInOrder(randomRewards[1].chance, randomRewards[2].chance)
      );

      uint256 bounds = randomRewardsLength - 1;
      for (uint256 i; i < bounds; ++i) {
        require(
          randomRewards[i].itemTokenId != randomRewards[randomRewardsLength - 1].itemTokenId,
          RandomRewardNoDuplicates()
        );
      }
    }
    if (randomRewards.length > 3) {
      actionRewards.randomRewardTokenId4 = randomRewards[3].itemTokenId;
      actionRewards.randomRewardChance4 = randomRewards[3].chance;
      actionRewards.randomRewardAmount4 = randomRewards[3].amount;
      require(
        actionRewards.randomRewardChance4 <= actionRewards.randomRewardChance3,
        RandomRewardsMustBeInOrder(randomRewards[2].chance, randomRewards[3].chance)
      );
      uint256 bounds = randomRewards.length - 1;
      for (uint256 i; i < bounds; ++i) {
        require(
          randomRewards[i].itemTokenId != randomRewards[randomRewards.length - 1].itemTokenId,
          RandomRewardNoDuplicates()
        );
      }
    }

    require(randomRewards.length <= 4, TooManyRandomRewards());
  }

  function _get16bitSlice(bytes memory b, uint256 index) internal pure returns (uint16) {
    uint256 key = index * 2;
    return uint16(b[key] | (bytes2(b[key + 1]) >> 8));
  }

  // Helper function to get random value between min and max (inclusive) for uint8
  function _getRandomInRange8(uint8 minValue, uint8 maxValue, uint8 randomness) internal pure returns (uint8) {
    if (maxValue <= minValue) {
      return minValue;
    }

    uint8 range = maxValue - minValue + 1;
    // Use modulo to get value in range and add minValue
    return uint8((uint16(randomness) % uint16(range)) + uint16(minValue));
  }
}
