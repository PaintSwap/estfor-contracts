//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract ERC1155HolderRogue is ERC1155Holder {
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

    (bool success, bytes memory data) = instantVRFActions.call{value: msg.value}(
      abi.encodeWithSignature("doInstantVRFActions(uint256,uint16[],uint256[])", playerId, actionIds, actionAmounts)
    );
    if (!success) {
      revert DoInstantVRFActionsFailed(data);
    }
  }

  function setRevertOnReceive(bool _revert) external {
    revertOnReceive = _revert;
  }

  function onERC1155Received(
    address _operator,
    address _from,
    uint256 _id,
    uint256 _value,
    bytes memory _data
  ) public override returns (bytes4) {
    if (revertOnReceive) {
      revert NotAcceptingERC1155();
    }
    return super.onERC1155Received(_operator, _from, _id, _value, _data);
  }

  function onERC1155BatchReceived(
    address _operator,
    address _from,
    uint256[] memory _ids,
    uint256[] memory _values,
    bytes memory _data
  ) public override returns (bytes4) {
    if (revertOnReceive) {
      revert NotAcceptingERC1155();
    }
    return super.onERC1155BatchReceived(_operator, _from, _ids, _values, _data);
  }
}
