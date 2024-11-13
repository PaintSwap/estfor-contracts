//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract TestERC1155HolderRogue is ERC1155Holder {
  event DoInstantVRFAction(bytes data);

  error NotAcceptingERC1155();
  error DoInstantVRFActionsFailed(bytes data);

  bool revertOnReceive;

  function doInstantVRFActions(
    address players,
    address instantVRFActions,
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata actionAmounts
  ) external payable {
    (bool success1, ) = players.call(abi.encodeWithSignature("setActivePlayer(uint256)", playerId));

    require(success1, NotAcceptingERC1155());
    (bool success, bytes memory data) = instantVRFActions.call{value: msg.value}(
      abi.encodeWithSignature("doInstantVRFActions(uint256,uint16[],uint256[])", playerId, actionIds, actionAmounts)
    );
    require(success, DoInstantVRFActionsFailed(data));
  }

  function setRevertOnReceive(bool _revert) external {
    revertOnReceive = _revert;
  }

  function onERC1155Received(
    address operator,
    address from,
    uint256 id,
    uint256 value,
    bytes memory data
  ) public override returns (bytes4) {
    require(!revertOnReceive, NotAcceptingERC1155());
    return super.onERC1155Received(operator, from, id, value, data);
  }

  function onERC1155BatchReceived(
    address operator,
    address from,
    uint256[] memory ids,
    uint256[] memory values,
    bytes memory data
  ) public override returns (bytes4) {
    require(!revertOnReceive, NotAcceptingERC1155());
    return super.onERC1155BatchReceived(operator, from, ids, values, data);
  }
}
