// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Player.sol";
import "./interfaces/ItemStat.sol";
import "./interfaces/IBrushToken.sol";

// The NFT contract contains data related to the users (not players)
contract PaintScapeNFT is ERC1155, Ownable {
  // Mystery box is id 1
  // Wearable items take ids 2-255
  // Other items (fish) take ids (256 - 1023)
  // Players are id 1024 onwards

  // Equippable Items, 2 - 31 (head)
  //             12 - 61 (necklace)
  //             91 (body)
  //             121 (rightArm)
  //             151 (leftArm)
  //             181 (legs)
  //             211 (dummy)
  //             241 (dummy1)

  event NewPlayer(address player, uint tokenId);

  // Dummy is there so that we start at 1
  enum Items {
    DUMMY,
    MYSTERY_BOX,
    BRUSH,
    WAND,
    SHIELD,
    BRONZE_NECKLACE,
    WOODEN_FISHING_ROD,
    IGNORE_NOW_OTHER_ITEMS,
    COD
  }

  uint16 public mysteryBoxsMinted;
  IBrushToken immutable brush;
  uint256 public mintMysteryBoxCost;

  mapping(address => uint) public players; // player => tokenId
  //    mapping(uint => address) public  // tokenId => player too?
  uint public latestPlayerId = 1024;
  mapping(address => mapping(uint256 => uint256)) public numEquipped; // user => tokenId => num equipped

  constructor(address _brush) ERC1155("") {
    brush = IBrushToken(_brush);
  }

  modifier onlyPlayer() {
    require(players[msg.sender] > 0);
    _;
  }

  function mintPlayer(bool _isMale) external {
    // Costs 5000 brush
    // brush.transferFrom(msg.sender, address(this), 1000 * 1 ether);
    // brush.burn(1000 * 1 ether);
    uint currentPlayerId = latestPlayerId;
    _mint(msg.sender, currentPlayerId, 1, "");
    Player player = new Player(address(this), currentPlayerId, _isMale);
    players[address(player)] = currentPlayerId;
    emit NewPlayer(address(player), currentPlayerId);
    ++latestPlayerId;
  }

  // Up to 1000, get a random item
  function mintMysteryBox(uint16 _num) external {
    // Costs 1000 brush
    require(mysteryBoxsMinted < 1000);

    brush.transferFrom(msg.sender, address(this), 1000 * 1 ether);
    brush.burn(1000 * 1 ether);

    _mint(msg.sender, uint256(Items.MYSTERY_BOX), _num, "");
    mysteryBoxsMinted += _num;
  }

  function openMysteryBox(uint256 _num) external {
    // Burn them, this will check approval/allowance etc
    _burn(msg.sender, uint256(Items.MYSTERY_BOX), _num);

    // Fetch random values from chainlink
  }

  function mintItem(
    address _to,
    uint256 _tokenId,
    uint256 _amount
  ) external onlyPlayer {
    _mint(_to, _tokenId, _amount, "");
  }

  function mintBatch(
    address _to,
    uint256[] calldata _ids,
    uint256[] calldata _amounts
  ) external onlyPlayer {
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

  // Need to think about this one
  //    function removeItem() onlyOwner {
  //    }

  function getItemStats(uint256 _tokenId) external view returns (ItemStat memory) {
    // Should be between 2 and 255
    require(_tokenId > 1 && _tokenId < 256);
    return itemStats[uint8(_tokenId)];
  }

  // This will revert if there is not enough free balance to equip
  function equip(uint256 _tokenId, address _from) external onlyPlayer {
    uint256 balance = balanceOf(_from, _tokenId);
    require(balance >= numEquipped[_from][_tokenId] + 1, "Do not have enough quantity to equip");
    require(_tokenId > 1 && _tokenId < 256);
    numEquipped[_from][_tokenId] += 1;
  }

  function unequip(uint256 _tokenId, address _from) external onlyPlayer {
    numEquipped[_from][_tokenId] -= 1;
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override {
    if (from == address(0)) {
      // When minting do nothing
      return;
    }

    // Don't allow users to transfer any if they would have a balance less than equiped.
    // i.e if equipped they cannot transfer it, but can transfer any excess unequipped
    uint256 i = ids.length;

    address[] memory accounts = new address[](ids.length);
    do {
      unchecked {
        --i;
      }
      accounts[i] = from;
    } while (i > 0);

    i = ids.length;
    uint256[] memory balances = balanceOfBatch(accounts, ids);

    do {
      uint256 tokenId = ids[i];
      // Transferring less than is equipped
      uint256 equipped = numEquipped[from][tokenId];
      require(balances[i] - equipped >= amounts[i]);
      unchecked {
        --i;
      }
    } while (i > 0);

    // TODO: Get player and consume any actions before transferring, so if
    // they die the new person getting the NFT doesn't lose anything.
  }

  /* Shop */
  mapping(uint => uint) shopItems;

  event AddShopItem(uint tokenId, uint cost);
  event RemoveShopItem(uint tokenId);

  // Spend brush to buy some things from the shop
  function addShopItem(uint _tokenId, uint _cost) external onlyOwner {
    shopItems[_tokenId] = _cost;
    emit AddShopItem(_tokenId, _cost);
  }

  function removeShopItem(uint _tokenId) external onlyOwner {
    delete shopItems[_tokenId];
    emit RemoveShopItem(_tokenId);
  }

  function buy(uint _tokenId, uint _quantity) external {
    require(shopItems[_tokenId] != 0, "Item cannot be bought");
    // Pay and burn brush
    brush.transferFrom(msg.sender, address(this), shopItems[_tokenId]);
    brush.burn(shopItems[_tokenId]);

    _mint(msg.sender, _tokenId, _quantity, "");
  }
}
