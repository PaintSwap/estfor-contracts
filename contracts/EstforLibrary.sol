// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {IPlayers} from "./interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// This file contains methods for interacting with generic functions like trimming strings, lowercase etc.
library EstforLibrary {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;

  function isWhitespace(bytes1 _char) internal pure returns (bool) {
    return
      _char == 0x20 || // Space
      _char == 0x09 || // Tab
      _char == 0x0a || // Line feed
      _char == 0x0D || // Carriage return
      _char == 0x0B || // Vertical tab
      _char == 0x00; // empty byte
  }

  function leftTrim(string memory _str) internal pure returns (string memory) {
    bytes memory b = bytes(_str);
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

  function rightTrim(string calldata _str) internal pure returns (string memory) {
    bytes memory b = bytes(_str);
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

  function trim(string calldata _str) external pure returns (string memory) {
    return leftTrim(rightTrim(_str));
  }

  // Assumes the string is already trimmed
  function containsValidNameCharacters(string calldata _name) external pure returns (bool) {
    bytes memory b = bytes(_name);
    bool lastCharIsWhitespace;
    U256 iter = b.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
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

  function containsValidDiscordCharacters(string calldata _discord) external pure returns (bool) {
    bytes memory discord = bytes(_discord);
    U256 iter = discord.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      bytes1 char = discord[i];

      bool isUpperCaseLetter = (char >= 0x41) && (char <= 0x5A); // A-Z
      bool isLowerCaseLetter = (char >= 0x61) && (char <= 0x7A); // a-z
      bool isDigit = (char >= 0x30) && (char <= 0x39); // 0-9
      if (!isUpperCaseLetter && !isLowerCaseLetter && !isDigit) {
        return false;
      }
    }

    return true;
  }

  function containsValidTelegramCharacters(string calldata _telegram) external pure returns (bool) {
    bytes memory telegram = bytes(_telegram);
    U256 iter = telegram.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      bytes1 char = telegram[i];

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

  function containsValidTwitterCharacters(string calldata _twitter) external pure returns (bool) {
    bytes memory twitter = bytes(_twitter);
    U256 iter = twitter.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      bytes1 char = twitter[i];

      bool isUpperCaseLetter = (char >= 0x41) && (char <= 0x5A); // A-Z
      bool isLowerCaseLetter = (char >= 0x61) && (char <= 0x7A); // a-z
      bool isDigit = (char >= 0x30) && (char <= 0x39); // 0-9
      if (!isUpperCaseLetter && !isLowerCaseLetter && !isDigit) {
        return false;
      }
    }

    return true;
  }

  function containsBaselineSocialNameCharacters(string calldata _socialMediaName) external pure returns (bool) {
    bytes memory socialMediaName = bytes(_socialMediaName);
    U256 iter = socialMediaName.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      bytes1 char = socialMediaName[i];

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

  function toLower(string memory _str) internal pure returns (string memory) {
    bytes memory lowerStr = abi.encodePacked(_str);
    U256 iter = lowerStr.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      if ((uint8(lowerStr[i]) >= 65) && (uint8(lowerStr[i]) <= 90)) {
        // So we add 32 to make it lowercase
        lowerStr[i] = bytes1(uint8(lowerStr[i]) + 32);
      }
    }
    return string(lowerStr);
  }

  // This should match the one below, useful when a calldata array is needed and for external testing
  function binarySearchMemory(uint48[] calldata _arr, uint256 _target) external pure returns (uint256) {
    uint256 low = 0;
    uint256 high = _arr.length - 1;

    while (low <= high) {
      uint256 mid = low + (high - low) / 2;

      if (_arr[mid] == _target) {
        return mid; // Element found
      } else if (_arr[mid] < _target) {
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

  // This should match the one above
  function _binarySearch(uint48[] storage _arr, uint256 _target) internal view returns (uint256) {
    uint256 low = 0;
    uint256 high = _arr.length - 1;

    while (low <= high) {
      uint256 mid = low + (high - low) / 2;

      if (_arr[mid] == _target) {
        return mid; // Element found
      } else if (_arr[mid] < _target) {
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

  function binarySearch(uint48[] storage _arr, uint256 _target) external view returns (uint256) {
    return _binarySearch(_arr, _target);
  }
}
