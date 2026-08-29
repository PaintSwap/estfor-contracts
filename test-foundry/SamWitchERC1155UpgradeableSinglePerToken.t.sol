// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {SamWitchERC1155UpgradeableSinglePerToken} from "../contracts/SamWitchERC1155UpgradeableSinglePerToken.sol";
import {
    TestSamWitchERC1155UpgradeableSinglePerToken
} from "../contracts/test/external/TestSamWitchERC1155UpgradeableSinglePerToken.sol";

contract SamWitchERC1155UpgradeableSinglePerTokenTest is EstforTest {
    uint256 private constant FIRST_TOKEN_ID = 1;
    uint256 private constant SECOND_TOKEN_ID = 2;
    uint256 private constant UNKNOWN_TOKEN_ID = 3;
    address private constant DEAD = address(0xdead);

    TestSamWitchERC1155UpgradeableSinglePerToken private token;

    function setUp() public {
        TestSamWitchERC1155UpgradeableSinglePerToken implementation = new TestSamWitchERC1155UpgradeableSinglePerToken();
        token = TestSamWitchERC1155UpgradeableSinglePerToken(
            _deployUUPS(address(implementation), abi.encodeCall(implementation.initialize, ()))
        );
    }

    function testBalanceOfReturnsZeroWhenAccountsOwnNoTokens() public {
        assertEq(token.balanceOf(address(this), FIRST_TOKEN_ID), 0);
        assertEq(token.balanceOf(ALICE, SECOND_TOKEN_ID), 0);
        assertEq(token.balanceOf(address(this), UNKNOWN_TOKEN_ID), 0);
    }

    function testBalanceOfReturnsOwnedToken() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");

        assertEq(token.balanceOf(address(this), FIRST_TOKEN_ID), 1);
        assertEq(token.balanceOf(ALICE, SECOND_TOKEN_ID), 0);
        assertEq(token.balanceOf(address(this), UNKNOWN_TOKEN_ID), 0);
    }

    function testBalanceOfBatchReturnsZerosWhenAccountsOwnNoTokens() public {
        address[] memory accounts = _addresses(address(this), ALICE, address(this));
        uint256[] memory ids = _uints(FIRST_TOKEN_ID, SECOND_TOKEN_ID, UNKNOWN_TOKEN_ID);

        assertEq(token.balanceOfBatch(accounts, ids), _uints(0, 0, 0));
    }

    function testBalanceOfBatchReturnsOwnedTokens() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        token.mint(ALICE, SECOND_TOKEN_ID, 1, "");

        address[] memory accounts = _addresses(ALICE, address(this), address(this));
        uint256[] memory ids = _uints(SECOND_TOKEN_ID, FIRST_TOKEN_ID, UNKNOWN_TOKEN_ID);
        assertEq(token.balanceOfBatch(accounts, ids), _uints(1, 1, 0));
    }

    function testBalanceOfBatchReturnsRepeatedBalances() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        token.mint(ALICE, SECOND_TOKEN_ID, 1, "");

        address[] memory accounts = _addresses(ALICE, ALICE, address(this));
        uint256[] memory ids = _uints(SECOND_TOKEN_ID, SECOND_TOKEN_ID, FIRST_TOKEN_ID);
        assertEq(token.balanceOfBatch(accounts, ids), _uints(1, 1, 1));
    }

    function testSafeTransferFromRevertsWhenAmountExceedsBalance() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155InsufficientBalance.selector, address(this), 1, 2, FIRST_TOKEN_ID
            )
        );
        token.safeTransferFrom(address(this), ALICE, FIRST_TOKEN_ID, 2, "");
    }

    function testSafeTransferFromTransfersAndPreservesSupply() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        token.safeTransferFrom(address(this), ALICE, FIRST_TOKEN_ID, 1, "");

        _assertSupplyAndBalance(FIRST_TOKEN_ID, 1, address(this), 0);
        assertEq(token.balanceOf(ALICE, FIRST_TOKEN_ID), 1);

        vm.prank(ALICE);
        token.safeTransferFrom(ALICE, address(this), FIRST_TOKEN_ID, 1, "");
        _assertSupplyAndBalance(FIRST_TOKEN_ID, 1, address(this), 1);
        assertEq(token.balanceOf(ALICE, FIRST_TOKEN_ID), 0);
    }

    function testSafeBatchTransferFromRevertsWhenAmountExceedsBalance() public {
        token.mintBatch(address(this), _uints(FIRST_TOKEN_ID, SECOND_TOKEN_ID), _uints(1, 1), "");

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155InsufficientBalance.selector, address(this), 1, 2, FIRST_TOKEN_ID
            )
        );
        token.safeBatchTransferFrom(address(this), ALICE, _uints(FIRST_TOKEN_ID), _uints(2), "");
    }

    function testSafeBatchTransferFromTransfersAndPreservesSupply() public {
        uint256[] memory ids = _uints(FIRST_TOKEN_ID, SECOND_TOKEN_ID);
        uint256[] memory amounts = _uints(1, 1);
        token.mintBatch(address(this), ids, amounts, "");
        token.safeBatchTransferFrom(address(this), ALICE, ids, amounts, "");

        assertEq(token.totalSupply(), 2);
        _assertTokenBalances(address(this), ALICE, 0, 1);

        vm.prank(ALICE);
        token.safeBatchTransferFrom(ALICE, address(this), ids, amounts, "");
        assertEq(token.totalSupply(), 2);
        _assertTokenBalances(address(this), ALICE, 1, 0);
    }

    function testMintRevertsWhenAmountExceedsOne() public {
        vm.expectRevert(SamWitchERC1155UpgradeableSinglePerToken.ERC1155MintingMoreThanOneSameNFT.selector);
        token.mint(address(this), FIRST_TOKEN_ID, 2, "");
    }

    function testMintRevertsWhenTokenAlreadyExists() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");

        vm.expectRevert(SamWitchERC1155UpgradeableSinglePerToken.ERC1155MintingMoreThanOneSameNFT.selector);
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
    }

    function testMintUpdatesSupplyAndBalance() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        _assertSupplyAndBalance(FIRST_TOKEN_ID, 1, address(this), 1);
        assertEq(token.totalSupply(SECOND_TOKEN_ID), 0);

        token.mint(address(this), SECOND_TOKEN_ID, 1, "");
        assertEq(token.totalSupply(), 2);
        assertEq(token.totalSupply(SECOND_TOKEN_ID), 1);
        assertEq(token.balanceOf(address(this), SECOND_TOKEN_ID), 1);
    }

    function testMintBatchRevertsWhenAnAmountExceedsOne() public {
        vm.expectRevert(SamWitchERC1155UpgradeableSinglePerToken.ERC1155MintingMoreThanOneSameNFT.selector);
        token.mintBatch(address(this), _uints(FIRST_TOKEN_ID, SECOND_TOKEN_ID), _uints(1, 2), "");
    }

    function testMintBatchRevertsWhenTokenAlreadyExists() public {
        token.mintBatch(address(this), _uints(FIRST_TOKEN_ID), _uints(1), "");

        vm.expectRevert(SamWitchERC1155UpgradeableSinglePerToken.ERC1155MintingMoreThanOneSameNFT.selector);
        token.mintBatch(address(this), _uints(FIRST_TOKEN_ID), _uints(1), "");
    }

    function testMintBatchUpdatesSupplyAndBalance() public {
        token.mintBatch(address(this), _uints(FIRST_TOKEN_ID), _uints(1), "");
        _assertSupplyAndBalance(FIRST_TOKEN_ID, 1, address(this), 1);
        assertEq(token.totalSupply(SECOND_TOKEN_ID), 0);

        token.mintBatch(address(this), _uints(SECOND_TOKEN_ID), _uints(1), "");
        assertEq(token.totalSupply(), 2);
        assertEq(token.totalSupply(SECOND_TOKEN_ID), 1);
        assertEq(token.balanceOf(address(this), SECOND_TOKEN_ID), 1);
    }

    function testBurnRevertsWhenAmountExceedsBalance() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155InsufficientBalance.selector, address(this), 1, 2, FIRST_TOKEN_ID
            )
        );
        token.burn(address(this), FIRST_TOKEN_ID, 2);
    }

    function testBurnUpdatesSupplyAndBalance() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        token.burn(address(this), FIRST_TOKEN_ID, 1);

        _assertSupplyAndBalance(FIRST_TOKEN_ID, 0, address(this), 0);
        assertEq(token.balanceOf(address(this), SECOND_TOKEN_ID), 0);
    }

    function testTransferToDeadAddressDoesNotReduceSupply() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        token.safeTransferFrom(address(this), DEAD, FIRST_TOKEN_ID, 1, "");

        _assertSupplyAndBalance(FIRST_TOKEN_ID, 1, address(this), 0);
        assertEq(token.balanceOf(DEAD, FIRST_TOKEN_ID), 1);
    }

    function testRemintAfterBurn() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        token.burn(address(this), FIRST_TOKEN_ID, 1);
        _assertSupplyAndBalance(FIRST_TOKEN_ID, 0, address(this), 0);

        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        _assertSupplyAndBalance(FIRST_TOKEN_ID, 1, address(this), 1);
    }

    function testBurnBatchRevertsWhenTokenIsNotOwned() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC1155Errors.ERC1155InsufficientBalance.selector, address(this), 0, 1, SECOND_TOKEN_ID
            )
        );
        token.burnBatch(address(this), _uints(SECOND_TOKEN_ID));
    }

    function testBurnBatchUpdatesSupplyAndBalance() public {
        token.mint(address(this), FIRST_TOKEN_ID, 1, "");
        token.burnBatch(address(this), _uints(FIRST_TOKEN_ID));

        _assertSupplyAndBalance(FIRST_TOKEN_ID, 0, address(this), 0);
    }

    function _assertSupplyAndBalance(uint256 id, uint256 supply, address account, uint256 balance) private {
        assertEq(token.totalSupply(), supply);
        assertEq(token.totalSupply(id), supply);
        assertEq(token.balanceOf(account, id), balance);
    }

    function _assertTokenBalances(address owner, address other, uint256 ownerBalance, uint256 otherBalance) private {
        assertEq(token.totalSupply(FIRST_TOKEN_ID), 1);
        assertEq(token.totalSupply(SECOND_TOKEN_ID), 1);
        assertEq(token.balanceOf(owner, FIRST_TOKEN_ID), ownerBalance);
        assertEq(token.balanceOf(other, FIRST_TOKEN_ID), otherBalance);
        assertEq(token.balanceOf(owner, SECOND_TOKEN_ID), ownerBalance);
        assertEq(token.balanceOf(other, SECOND_TOKEN_ID), otherBalance);
    }
}
