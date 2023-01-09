// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IPaintScapeNFT {
  function players(address player) external view returns (bool);
}

// Someone owns the raid and can add/remove people
contract PrivateRaid is Ownable {
  // Up to 10 people
  mapping(address => bool) public availableMembers;
  uint numMembers;

  uint public constant MAX_MEMBERS = 10;

  constructor(address[] memory members) {
    // Add the members
    if (members.length > 0) {
      uint i;
      do {
        require(!availableMembers[members[i]]); // duplicate, TODO: Require members are sorted off-chain and just compare last one
        availableMembers[members[i]] = true;
        unchecked {
          ++i;
        }
      } while (i < members.length);
    }
  }

  function addMember(address _member) external onlyOwner {
    require(numMembers < MAX_MEMBERS, "Maxed out");
    require(!availableMembers[_member], "Already added");
    availableMembers[_member] = true;
    ++numMembers;
  }

  function removeMember(address _member) external onlyOwner {
    require(availableMembers[_member], "Not added");
    availableMembers[_member] = false;
    --numMembers;
  }

  // function addMembers
  // function removeMembers
}

contract Raid {
  event JoinedRaid(address player);

  IPaintScapeNFT nft;
  uint40 startTime;

  //    mapping();

  constructor(address _nft) {
    nft = IPaintScapeNFT(_nft);
  }

  function joinRaid(address _player) external {
    require(nft.players(_player));

    emit JoinedRaid(_player);
  }

  function leaveRaid() external {}

  function availableLoot() external {}

  function startRaid() external {}

  function simulate() external {}
}
