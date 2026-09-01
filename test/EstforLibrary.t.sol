// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {EstforLibrary} from "../contracts/EstforLibrary.sol";

contract EstforLibraryTest is EstforTest {
    string private constant UPPER_CASE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    string private constant LOWER_CASE_LETTERS = "abcdefghijklmnopqrstuvwxyz";
    string private constant DIGITS = "0123456789";

    function testTrimString() public pure {
        assertEq(EstforLibrary.trim("  hello  "), "hello");
        assertEq(EstforLibrary.trim("hello  "), "hello");
        assertEq(EstforLibrary.trim("  hello"), "hello");
        assertEq(EstforLibrary.trim("hello"), "hello");
        assertEq(EstforLibrary.trim(" "), "");
        assertEq(EstforLibrary.trim(""), "");
        assertEq(EstforLibrary.trim("Alice"), "Alice");
        assertEq(EstforLibrary.trim("Sam test clan"), "Sam test clan");
        assertEq(EstforLibrary.trim("Double  space"), "Double  space");
    }

    function testValidateNames() public pure {
        string memory allowedCharacters = string.concat(UPPER_CASE_LETTERS, LOWER_CASE_LETTERS, DIGITS, "-_ .");
        assertTrue(EstforLibrary.containsValidNameCharacters(allowedCharacters));

        bytes memory nonAllowedCharacters = bytes("@!#$%^&*()+={}[]|;\"'<>,/?`~");
        for (uint256 i; i < nonAllowedCharacters.length; ++i) {
            assertFalse(EstforLibrary.containsValidNameCharacters(string(abi.encodePacked(nonAllowedCharacters[i]))));
        }

        assertFalse(EstforLibrary.containsValidNameCharacters("Double  space"));
        assertFalse(EstforLibrary.containsValidNameCharacters("Triple   space"));
        assertTrue(EstforLibrary.containsValidNameCharacters("Single space"));
    }

    function testValidateDiscordInviteCode() public pure {
        string memory allowedCharacters = string.concat(UPPER_CASE_LETTERS, LOWER_CASE_LETTERS, DIGITS);
        assertTrue(EstforLibrary.containsValidDiscordCharacters(allowedCharacters));

        bytes memory nonAllowedCharacters = bytes("@!#$%^&*()+={}[]|;\"'<>,/?`~ _-.");
        for (uint256 i; i < nonAllowedCharacters.length; ++i) {
            assertFalse(EstforLibrary.containsValidDiscordCharacters(string(abi.encodePacked(nonAllowedCharacters[i]))));
        }
    }

    function testValidateTelegramHandle() public pure {
        string memory allowedCharacters = string.concat(UPPER_CASE_LETTERS, LOWER_CASE_LETTERS, DIGITS, "+");
        assertTrue(EstforLibrary.containsValidTelegramCharacters(allowedCharacters));

        bytes memory nonAllowedCharacters = bytes("@!#$%^&*()={}[]|;\"'<>,/?`~ _-.");
        for (uint256 i; i < nonAllowedCharacters.length; ++i) {
            assertFalse(
                EstforLibrary.containsValidTelegramCharacters(string(abi.encodePacked(nonAllowedCharacters[i])))
            );
        }
    }

    function testBinarySearch() public pure {
        assertEq(EstforLibrary.binarySearchMemory(_uint64s(1), 4), type(uint256).max);
        assertEq(EstforLibrary.binarySearchMemory(_uint64s(1), 1), 0);
        assertEq(EstforLibrary.binarySearchMemory(_uint64s(2), 1), type(uint256).max);

        uint64[] memory values = _uint64s(1, 2, 4, 7, 12);
        assertEq(EstforLibrary.binarySearchMemory(values, 4), 2);
        assertEq(EstforLibrary.binarySearchMemory(values, 5), type(uint256).max);
        assertEq(EstforLibrary.binarySearchMemory(values, 1), 0);
        assertEq(EstforLibrary.binarySearchMemory(values, 12), 4);
        assertEq(EstforLibrary.binarySearchMemory(values, 0), type(uint256).max);
        assertEq(EstforLibrary.binarySearchMemory(_uint64s(0, 1, 2, 4, 7, 12), 0), 0);
    }

    function _uint64s(uint64 a) private pure returns (uint64[] memory values) {
        values = new uint64[](1);
        values[0] = a;
    }

    function _uint64s(uint64 a, uint64 b, uint64 c, uint64 d, uint64 e) private pure returns (uint64[] memory values) {
        values = new uint64[](5);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
    }

    function _uint64s(uint64 a, uint64 b, uint64 c, uint64 d, uint64 e, uint64 f)
        private
        pure
        returns (uint64[] memory values)
    {
        values = new uint64[](6);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
        values[5] = f;
    }
}
