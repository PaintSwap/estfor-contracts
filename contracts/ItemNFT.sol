// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./interfaces/ItemStat.sol";
import "./interfaces/IBrushToken.sol";
import "./World.sol";
import "./Users.sol";
import "./enums.sol";

// The NFT contract contains data related to the items and users (not players)
contract ItemNFT is ERC1155, Multicall, Ownable {
  // Mystery box is id 1
  // Raid pass is id 2
  // Reserved up to 3-10
  // Wearable items take ids 11-255
  // Other items (e.g fish) take ids (256 - 65535)

  // Equippable Items, 11 - 40 (head)
  //             70 (necklace)
  //             100 (body)
  //             130 (rightArm)
  //             160 (leftArm)
  //             190 (legs)
  //             220 (boots)
  //       222 - 250 (aux)
  // 251 - 255 reserved

  mapping(uint => uint) totalBalances; // tokenId => total

  uint16 public mysteryBoxsMinted;
  IBrushToken immutable brush;
  World immutable world;
  Users immutable users;
  address playerNFT;
  uint256 public mintMysteryBoxCost;

  /* Shop */
  mapping(uint => uint) private shopItems;
  event AddShopItem(uint tokenId, uint price);
  event AddShopItems(uint[] tokenIds, uint[] prices);
  event RemoveShopItem(uint tokenId);
  event BuyFromShop(uint tokenId, uint quantity);
  event BuyBatchFromShop(uint[] tokenIds, uint[] quantities);

  constructor(
    IBrushToken _brush,
    World _world,
    Users _users
  ) ERC1155("") {
    brush = _brush;
    world = _world;
    users = _users;
  }

  function setPlayerNFT(address _playerNFT) external onlyOwner {
    playerNFT = _playerNFT;
  }

  modifier onlyPlayerNFT() {
    require(playerNFT == msg.sender);
    _;
  }

  // Map timestamp
  mapping(uint => uint) lockedItems;
  uint mysteryBoxStart = 100_000;

  // Up to 1000, get a random item
  function mintMysteryBox(uint16 _num) external {
    require(mysteryBoxStart < 101_000); // Can only have 1000 minted?

    // Costs 1000 brush
    brush.transferFrom(msg.sender, address(this), 1000 * _num * 1 ether);
    brush.burn((1000 * _num * 1 ether) / 2); // Burn half

    uint startTokenId = mysteryBoxStart;

    for (uint i = 0; i < _num; ++i) {
      _mint(msg.sender, startTokenId + i, 1, "");
      // Each mystery box will have a unlock date 1 day over the
      lockedItems[startTokenId + i] = block.timestamp + 1 days;
    }
    mysteryBoxStart += startTokenId + _num;
  }

  //  function

  function openMysteryBox(uint _tokenId) external {
    uint timestamp = lockedItems[_tokenId];
    uint seed = world.getSeed(timestamp);
    //    seed ^ _tokenId
    // Burn them, this will check approval/allowance etc
    _burn(msg.sender, uint256(Items.MYSTERY_BOX), 1);

    // Fetch random values from chainlink
  }

  function mint(
    address _to,
    uint256 _tokenId,
    uint256 _amount
  ) external onlyPlayerNFT {
    totalBalances[_tokenId] += _amount;
    _mint(_to, _tokenId, _amount, "");
  }

  function mintBatch(
    address _to,
    uint256[] calldata _ids,
    uint256[] calldata _amounts
  ) external onlyPlayerNFT {
    for (uint i = 0; i < _ids.length; ++i) {
      totalBalances[_ids[i]] += _amounts[i];
    }
    _mintBatch(_to, _ids, _amounts, "");
  }

  function uri(uint256 _tokenId) public view virtual override returns (string memory) {
    if (_tokenId == 0) {
      // Mystery box
    } else if (_tokenId < 200) {
      // Item
    } else {
      // Player
      // It might also not exist (require)
    }

    return "empty";
  }

  mapping(uint8 => ItemStat) itemStats;

  // Or make it constants and redeploy the contracts
  function addItem(uint8 _item, ItemStat calldata _itemStat) external onlyOwner {
    require(itemStats[_item].bonus == 0, "This item was already added");
    itemStats[_item] = _itemStat;
  }

  function editItem(uint8 _item, ItemStat calldata _itemStat) external onlyOwner {
    require(itemStats[_item].bonus != 0, "This item was not added yet");
    require(itemStats[_item].equipPosition == _itemStat.equipPosition, "Equipment position should not change");
    itemStats[_item] = _itemStat;
  }

  function getItemStats(uint256 _tokenId) external view returns (ItemStat memory) {
    // Should be between 2 and 255
    require(_tokenId > 1 && _tokenId < 256);
    return itemStats[uint8(_tokenId)];
  }

  function _beforeTokenTransfer(
    address, /*_operator*/
    address _from,
    address _to,
    uint256[] memory _ids,
    uint256[] memory _amounts,
    bytes memory /*_data*/
  ) internal virtual override {
    if (_from == address(0) || _amounts.length == 0) {
      // When minting do nothing
      return;
    }

    uint256 i = _ids.length;
    if (_to == address(0)) {
      // burning
      do {
        unchecked {
          --i;
        }
        totalBalances[_ids[i]] += _amounts[i];
      } while (i > 0);
    }

    // Don't allow users to transfer any if they would have a balance less than equiped.
    // i.e if equipped they cannot transfer it, but can transfer any excess unequipped
    i = _ids.length;

    address[] memory accounts = new address[](_ids.length);
    do {
      unchecked {
        --i;
      }
      accounts[i] = _from;
    } while (i > 0);

    i = _ids.length;
    uint256[] memory balances = balanceOfBatch(accounts, _ids);

    do {
      uint256 tokenId = _ids[i];
      // Transferring less than is equipped
      uint256 unavailable = users.itemAmountUnavailable(_from, tokenId);
      require(balances[i] - unavailable >= _amounts[i]);
      unchecked {
        --i;
      }
    } while (i > 0);
  }

  /* Shop */
  // Spend brush to buy some things from the shop
  function addShopItem(uint _tokenId, uint _price) external onlyOwner {
    shopItems[_tokenId] = _price;
    emit AddShopItem(_tokenId, _price);
  }

  function addShopBatchItem(uint[] calldata _tokenIds, uint[] calldata _prices) external onlyOwner {
    require(_tokenIds.length == _prices.length);
    require(_tokenIds.length > 0);
    uint i;
    do {
      shopItems[_tokenIds[i]] = _prices[i];
      unchecked {
        ++i;
      }
    } while (i < _tokenIds.length);
    emit AddShopItems(_tokenIds, _prices);
  }

  function removeShopItem(uint _tokenId) external onlyOwner {
    delete shopItems[_tokenId];
    emit RemoveShopItem(_tokenId);
  }

  // Buy simple items and XP boosts using brush
  function buy(uint _tokenId, uint _quantity) external {
    uint price = shopItems[_tokenId];
    require(price != 0, "Item cannot be bought");
    // Pay
    brush.transferFrom(msg.sender, address(this), price);
    // Burn half, the rest goes into the pool for sellable items
    brush.burn(price / 2);

    _mint(msg.sender, _tokenId, _quantity, "");
    emit BuyFromShop(_tokenId, _quantity);
  }

  function buyBatch(uint[] calldata _tokenIds, uint[] calldata _quantities) external {
    require(_tokenIds.length == _quantities.length);
    uint totalBrush;
    for (uint i = 0; i < _tokenIds.length; ++i) {
      uint price = shopItems[_tokenIds[i]];
      require(price != 0, "Item cannot be bought");
      totalBrush += price * _quantities[i];
    }

    // Pay
    brush.transferFrom(msg.sender, address(this), totalBrush);
    // Burn half, the rest goes into the pool for sellable items
    brush.burn(totalBrush / 2);

    _mintBatch(msg.sender, _tokenIds, _quantities, "");
    emit BuyBatchFromShop(_tokenIds, _quantities);
  }

  uint numItems; // unique number of items

  function getPriceForItem(uint _tokenId) public view returns (uint price) {
    uint totalBrush = brush.balanceOf(address(this));
    uint totalBrushForItem = totalBrush / numItems;
    uint totalOfThisItem = totalBalances[_tokenId];
    if (totalOfThisItem < 100) {
      // Need to be a minimum of an item before any can be sold.
      return 0;
    }
    return totalBrushForItem / totalOfThisItem;
  }

  function getPriceForItems(uint[] calldata _tokenIds) public view returns (uint[] memory prices) {
    if (_tokenIds.length == 0) {
      return prices;
    }

    uint totalBrush = brush.balanceOf(address(this));
    uint totalBrushForItem = totalBrush / numItems;

    prices = new uint[](_tokenIds.length);
    uint i;
    do {
      uint totalOfThisItem = totalBalances[_tokenIds[i]];
      if (totalOfThisItem < 100) {
        // Need to be a minimum of an item before any can be sold.
        prices[i] = 0;
      } else {
        prices[i] = totalBrushForItem / totalOfThisItem;
      }

      unchecked {
        ++i;
      }
    } while (i < prices.length);
  }

  // Slippage as a % base 10000
  function sell(
    uint _tokenId,
    uint _quantity,
    uint _slippage
  ) public {
    uint brushPerToken = getPriceForItem(_tokenId);
    _burn(msg.sender, _tokenId, _quantity);
    brush.transfer(msg.sender, brushPerToken * _quantity);
  }

  function setllBatch(
    uint[] calldata _tokenIds,
    uint[] calldata _quantities,
    uint _slippage
  ) external {
    for (uint i = 0; i < _tokenIds.length; ++i) {
      sell(_tokenIds[i], _quantities[i], _slippage);
    }
  }

  /* Raids */
  /*
  function joinRaid(address _owner, uint _raidId) external onlyPlayer {
    // Check that it's not finished yet
    address player = msg.sender;
    require(raids[_raidId].startTime + raids[_raidId].timespan < block.timestamp, "Already finished");
    require(raids[_raidId].startTime > 0, "Raid does not exist");

    // Needs a raid pass which gets burnt.
    _burn(_owner, uint(Items.RAID_PASS), 1);

    raids[_raidId].numMembers += 1;
    raids[_raidId].members[player] = true;

    emit JoinedRaid(player, _raidId);
  }

  function leaveRaid(uint _raidId) external onlyPlayer {
    address player = msg.sender;

    // Raid must not have started yet
    require(raids[_raidId].startTime + raids[_raidId].timespan < block.timestamp, "Already finished");

    raids[_raidId].numMembers -= 1;
    delete raids[_raidId].members[player];

    emit LeaveRaid(player, _raidId);
  }

  function loot() external view {}

  struct Loot {
    Items item;
    uint amount;
  }

  function availableLoot(uint _raidId, Player _player) external view returns (Loot[] memory loot) {
    uint40 timestamp = raids[_raidId].startTime + raids[_raidId].timespan + 1 days;
    uint seed = world.getSeed(timestamp); // Can only get it after the next day

    uint randomNumber = uint(uint40(bytes5(bytes32(seed) ^ bytes32(bytes20(address(_player)))))); // High most 12 bytes are not affected so don't use those.

    uint multiplier = _player.getLootBonusMultiplier();

    uint adjustedRandomNumber = randomNumber / multiplier;

    loot = new Loot[](5); // MAX

    uint lootNum = 1;

    // This is only 5 bytes long
    if (randomNumber % 2 == 0) {
      // If even you at least get this
      loot[0] = Loot({item: Items.SHIELD, amount: 1});
    } else {
      // If off you at least get that
      loot[0] = Loot({item: Items.WAND, amount: 1});
    }

    if (adjustedRandomNumber <= 2 ^ 4) {
      loot[1] = Loot({item: Items.SHIELD, amount: 1});
      if (adjustedRandomNumber <= 2 ^ 3) {
        loot[2] = Loot({item: Items.SHIELD, amount: 1});
        if (adjustedRandomNumber <= 2 ^ 2) {
          loot[3] = Loot({item: Items.SHIELD, amount: 1});
          if (adjustedRandomNumber <= 2) {
            // Ultimate item
            loot[4] = Loot({item: Items.SHIELD, amount: 1});
            lootNum = 5;
          } else {
            lootNum = 4;
          }
        } else {
          lootNum = 3;
        }
      } else {
        lootNum = 2;
      }
    }
    /// @solidity memory-safe-assembly
    assembly {
      mstore(loot, lootNum)
    }
  }
*/
}
