// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import {Enum} from "./Enum.sol";

/**
 * @title Safe Interface
 * @notice A multi-signature wallet with support for confirmations using signed messages based on EIP-712.
 * @dev This is a Solidity interface definition to the Safe account.
 * @author @safe-global/safe-protocol
 */
interface ISafe {
    /**
     * @notice Execute `operation` to `to` with native token `value`.
     * @param to Destination address of the module transaction.
     * @param value Native token value of the module transaction.
     * @param data Data payload of the module transaction.
     * @param operation Operation type of the module transaction: 0 for `CALL` and 1 for `DELEGATECALL`.
     * @return success Boolean flag indicating if the call succeeded.
     */
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) external returns (bool success);
}