// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IPlayers {
  function clearEverythingBeforeTokenTransfer(address _from, uint _tokenId) external;

  function getURI(
    bytes32 _name,
    bytes32 _avatarName,
    string calldata _avatarDescription,
    string calldata _imageURI
  ) external view returns (string memory);

  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external;

  function itemBeforeTokenTransfer(address _from, uint[] calldata _tokenIds, uint256[] calldata _amounts) external;
}
