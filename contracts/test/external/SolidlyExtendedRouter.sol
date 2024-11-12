/**
 *Submitted for verification at ftmscan.com on 2023-09-18
 */

/**
 *Submitted for verification at gnosisscan.io on 2023-09-17
 */

// SPDX-License-Identifier: Unlicensed
// Solidly Extended - Router Staker
// ftm.guru's extension of Solidly Extended to Stake Liquidity into Gauge, directly.

// Solidly Extended
// ftm.guru's extension of Solidly's periphery (Router)
// https://github.com/andrecronje/solidly/blob/master/contracts/BaseV1-periphery.sol
//
// BaseV1Router02.sol : Supporting Fee-on-transfer Tokens
// https://github.com/ftm1337/solidly-with-FoT/blob/master/contracts/BaseV1-periphery.sol

/**v1.3.17
 *0x2aa07920E4ecb4ea8C801D9DFEce63875623B285
 *Submitted for verification at FtmScan.com on 2023-04-03
 */
/**v1.1.0
 *0x1A05EB736873485655F29a37DEf8a0AA87F5a447
 *Submitted for verification at FtmScan.com on 2022-11-18
 */

/**
 *  EQUALIZER EXCHANGE
 *  The New Liquidity Hub of Fantom chain!
 *  https://equalizer.exchange  (Dapp)
 *  https://discord.gg/MaMhbgHMby   (Community)
 *
 *
 *
 *  Version: 2.0.5
 *  - RouterStaker is a drop-in replacement for Router2
 *  - Stakes all added liquidity directly into the related EqualizerV2 gauge.
 *
 *  Version: 1.3.17
 *	- Add Support for Fee-on-Transfer tokens (Original work Based on "Solidly Extended" by ftm.guru)
 *	- Remove "calculation" of Pair Address and instead use Factory.pairFor
 *
 *
 *  Contributors:
 *   -   Andre Cronje, Solidly.Exchange
 *   -   543#3017 (Sam), ftm.guru & Equalizer.exchange
 *
 *
 */
// File: contracts/interfaces/IRouter.sol

pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRouter {
  function pairFor(address tokenA, address tokenB, bool stable) external view returns (address pair);
}

// File: contracts/interfaces/IWETH.sol

interface IWETH {
  function deposit() external payable returns (uint);

  function transfer(address to, uint256 value) external returns (bool);

  function withdraw(uint) external returns (uint);
}

// File: contracts/interfaces/IPairFactory.sol

interface IPairFactory {
  function isPaused() external view returns (bool);

  function allPairsLength() external view returns (uint);

  function isPair(address pair) external view returns (bool);

  function getFee(bool _stable) external view returns (uint256);

  function pairCodeHash() external pure returns (bytes32);

  function getPair(address tokenA, address token, bool stable) external view returns (address);

  function getInitializable() external view returns (address, address, bool);

  function createPair(address tokenA, address tokenB, bool stable) external returns (address pair);
}

// File: contracts/interfaces/IPair.sol

interface IPair {
  function metadata()
    external
    view
    returns (uint256 dec0, uint256 dec1, uint256 r0, uint256 r1, bool st, address t0, address t1);

  function claimFees() external returns (uint, uint);

  function tokens() external returns (address, address);

  function transferFrom(address src, address dst, uint256 amount) external returns (bool);

  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;

  function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;

  function burn(address to) external returns (uint256 amount0, uint256 amount1);

  function mint(address to) external returns (uint256 liquidity);

  function getReserves() external view returns (uint256 _reserve0, uint256 _reserve1, uint256 _blockTimestampLast);

  function getAmountOut(uint, address) external view returns (uint);
}

// File: contracts/interfaces/IGaugeEquivalent.sol

interface IGaugeEquivalent {
  function deposit(uint256 amount) external;

  function depositFor(address _user, uint256 amount) external;

  function depositAll() external;

  function depositAllFor(address _user) external;
}

// File: contracts/interfaces/IVoter.sol

interface IVoter {
  function gauges(address _pool) external view returns (address _gauge);
}

// File: contracts/interfaces/IERC20.sol

// File: contracts/libraries/Math.sol

library Math {
  function max(uint256 a, uint256 b) internal pure returns (uint) {
    return a >= b ? a : b;
  }

  function min(uint256 a, uint256 b) internal pure returns (uint) {
    return a < b ? a : b;
  }

  function sqrt(uint256 y) internal pure returns (uint256 z) {
    if (y > 3) {
      z = y;
      uint256 x = y / 2 + 1;
      while (x < z) {
        z = x;
        x = (y / x + x) / 2;
      }
    } else if (y != 0) {
      z = 1;
    }
  }

  function cbrt(uint256 n) internal pure returns (uint256) {
    unchecked {
      uint256 x = 0;
      for (uint256 y = 1 << 255; y > 0; y >>= 3) {
        x <<= 1;
        uint256 z = 3 * x * (x + 1) + 1;
        if (n / y >= z) {
          n -= y * z;
          x += 1;
        }
      }
      return x;
    }
  }
}

// File: contracts/Router.sol

// Solidly Extended - Router Staker
// ftm.guru's extension of Solidly Extended to Stake Liquidity into Gauge, directly.
contract SolidlyExtendedRouter is IRouter {
  struct Route {
    address from;
    address to;
    bool stable;
  }

  uint256 internal constant MINIMUM_LIQUIDITY = 10 ** 3;
  address public immutable factory;
  IWETH public immutable weth;
  IVoter public immutable voter;
  bytes32 public immutable pairCodeHash;

  modifier ensure(uint256 deadline) {
    require(deadline >= block.timestamp, "Equalizer Router: EXPIRED");
    _;
  }

  constructor(address _factory, address _weth, address _voter) {
    factory = _factory;
    pairCodeHash = IPairFactory(_factory).pairCodeHash();
    weth = IWETH(_weth);
    voter = IVoter(_voter);
  }

  /// @dev only accept ETH via fallback from the WETH contract
  receive() external payable {
    assert(msg.sender == address(weth));
  }

  function sortTokens(address tokenA, address tokenB) public pure returns (address token0, address token1) {
    require(tokenA != tokenB, "Equalizer Router: IDENTICAL_ADDRESSES");
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), "Equalizer Router: ZERO_ADDRESS");
  }

  /// @dev calculates the CREATE2 address for a pair without making any external calls
  function pairFor(address tokenA, address tokenB, bool stable) public view returns (address pair) {
    /*
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(uint160(uint256(keccak256(abi.encodePacked(
            hex'ff',
            factory,
            keccak256(abi.encodePacked(token0, token1, stable)),
            pairCodeHash // init code hash
        )))));
        */
    return IPairFactory(factory).getPair(tokenA, tokenB, stable);
  }

  /// @dev given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
  function quoteLiquidity(uint256 amountA, uint256 reserveA, uint256 reserveB) internal pure returns (uint256 amountB) {
    require(amountA > 0, "Equalizer Router: INSUFFICIENT_AMOUNT");
    require(reserveA > 0 && reserveB > 0, "Equalizer Router: INSUFFICIENT_LIQUIDITY");
    amountB = (amountA * reserveB) / reserveA;
  }

  /// @dev fetches and sorts the reserves for a pair
  function getReserves(
    address tokenA,
    address tokenB,
    bool stable
  ) public view returns (uint256 reserveA, uint256 reserveB) {
    (address token0, ) = sortTokens(tokenA, tokenB);
    (uint256 reserve0, uint256 reserve1, ) = IPair(pairFor(tokenA, tokenB, stable)).getReserves();
    (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
  }

  /// @dev performs chained getAmountOut calculations on any number of pairs
  function getAmountOut(
    uint256 amountIn,
    address tokenIn,
    address tokenOut
  ) public view returns (uint256 amount, bool stable) {
    address pair = pairFor(tokenIn, tokenOut, true);
    uint256 amountStable;
    uint256 amountVolatile;
    if (IPairFactory(factory).isPair(pair)) {
      amountStable = IPair(pair).getAmountOut(amountIn, tokenIn);
    }
    pair = pairFor(tokenIn, tokenOut, false);
    if (IPairFactory(factory).isPair(pair)) {
      amountVolatile = IPair(pair).getAmountOut(amountIn, tokenIn);
    }
    return amountStable > amountVolatile ? (amountStable, true) : (amountVolatile, false);
  }

  /// @dev performs chained getAmountOut calculations on any number of pairs
  function getAmountsOut(uint256 amountIn, Route[] memory routes) public view returns (uint256[] memory amounts) {
    require(routes.length >= 1, "Equalizer Router: INVALID_PATH");
    amounts = new uint256[](routes.length + 1);
    amounts[0] = amountIn;
    for (uint256 i = 0; i < routes.length; ++i) {
      address pair = pairFor(routes[i].from, routes[i].to, routes[i].stable);
      if (IPairFactory(factory).isPair(pair)) {
        amounts[i + 1] = IPair(pair).getAmountOut(amounts[i], routes[i].from);
      }
    }
  }

  function isPair(address pair) external view returns (bool) {
    return IPairFactory(factory).isPair(pair);
  }

  function quoteAddLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 amountADesired,
    uint256 amountBDesired
  ) external view returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
    // create the pair if it doesn't exist yet
    address _pair = IPairFactory(factory).getPair(tokenA, tokenB, stable);
    (uint256 reserveA, uint256 reserveB) = (0, 0);
    uint256 _totalSupply = 0;
    if (_pair != address(0)) {
      _totalSupply = IERC20(_pair).totalSupply();
      (reserveA, reserveB) = getReserves(tokenA, tokenB, stable);
    }
    if (reserveA == 0 && reserveB == 0) {
      (amountA, amountB) = (amountADesired, amountBDesired);
      liquidity = Math.sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
    } else {
      uint256 amountBOptimal = quoteLiquidity(amountADesired, reserveA, reserveB);
      if (amountBOptimal <= amountBDesired) {
        (amountA, amountB) = (amountADesired, amountBOptimal);
        liquidity = Math.min((amountA * _totalSupply) / reserveA, (amountB * _totalSupply) / reserveB);
      } else {
        uint256 amountAOptimal = quoteLiquidity(amountBDesired, reserveB, reserveA);
        (amountA, amountB) = (amountAOptimal, amountBDesired);
        liquidity = Math.min((amountA * _totalSupply) / reserveA, (amountB * _totalSupply) / reserveB);
      }
    }
  }

  function quoteRemoveLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 liquidity
  ) external view returns (uint256 amountA, uint256 amountB) {
    // create the pair if it doesn't exist yet
    address _pair = IPairFactory(factory).getPair(tokenA, tokenB, stable);

    if (_pair == address(0)) {
      return (0, 0);
    }

    (uint256 reserveA, uint256 reserveB) = getReserves(tokenA, tokenB, stable);
    uint256 _totalSupply = IERC20(_pair).totalSupply();

    amountA = (liquidity * reserveA) / _totalSupply; // using balances ensures pro-rata distribution
    amountB = (liquidity * reserveB) / _totalSupply; // using balances ensures pro-rata distribution
  }

  function _addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin
  ) internal returns (uint256 amountA, uint256 amountB) {
    require(amountADesired >= amountAMin, "Equalizer Router: invalid desired amountA");
    require(amountBDesired >= amountBMin, "Equalizer Router: invalid desired amountB");
    // create the pair if it doesn't exist yet
    address _pair = IPairFactory(factory).getPair(tokenA, tokenB, stable);
    if (_pair == address(0)) {
      _pair = IPairFactory(factory).createPair(tokenA, tokenB, stable);
    }
    (uint256 reserveA, uint256 reserveB) = getReserves(tokenA, tokenB, stable);
    if (reserveA == 0 && reserveB == 0) {
      (amountA, amountB) = (amountADesired, amountBDesired);
    } else {
      uint256 amountBOptimal = quoteLiquidity(amountADesired, reserveA, reserveB);
      if (amountBOptimal <= amountBDesired) {
        require(amountBOptimal >= amountBMin, "Equalizer Router: INSUFFICIENT_B_AMOUNT");
        (amountA, amountB) = (amountADesired, amountBOptimal);
      } else {
        uint256 amountAOptimal = quoteLiquidity(amountBDesired, reserveB, reserveA);
        assert(amountAOptimal <= amountADesired);
        require(amountAOptimal >= amountAMin, "Equalizer Router: INSUFFICIENT_A_AMOUNT");
        (amountA, amountB) = (amountAOptimal, amountBDesired);
      }
    }
  }

  function addLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
  ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
    (amountA, amountB) = _addLiquidity(tokenA, tokenB, stable, amountADesired, amountBDesired, amountAMin, amountBMin);
    address pair = pairFor(tokenA, tokenB, stable);
    _safeTransferFrom(tokenA, msg.sender, pair, amountA);
    _safeTransferFrom(tokenB, msg.sender, pair, amountB);
    {
      // sub-scope interactions
      address _gauge = voter.gauges(pair);
      if (_gauge == address(0)) {
        liquidity = IPair(pair).mint(to);
      } else {
        liquidity = IPair(pair).mint(address(this));
        if (IERC20(pair).allowance(address(this), _gauge) < liquidity) {
          IERC20(pair).approve(_gauge, type(uint256).max);
        }
        IGaugeEquivalent(_gauge).depositAllFor(to);
      }
    }
  }

  function addLiquidityETH(
    address token,
    bool stable,
    uint256 amountTokenDesired,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline
  ) external payable ensure(deadline) returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
    (amountToken, amountETH) = _addLiquidity(
      token,
      address(weth),
      stable,
      amountTokenDesired,
      msg.value,
      amountTokenMin,
      amountETHMin
    );
    address pair = pairFor(token, address(weth), stable);
    _safeTransferFrom(token, msg.sender, pair, amountToken);
    weth.deposit{value: amountETH}();
    assert(weth.transfer(pair, amountETH));
    {
      // sub-scope interactions
      address _gauge = voter.gauges(pair);
      if (_gauge == address(0)) {
        liquidity = IPair(pair).mint(to);
      } else {
        liquidity = IPair(pair).mint(address(this));
        if (IERC20(pair).allowance(address(this), _gauge) < liquidity) {
          IERC20(pair).approve(_gauge, type(uint256).max);
        }
        IGaugeEquivalent(_gauge).depositAllFor(to);
      }
    }
    // refund dust eth, if any
    if (msg.value > amountETH) _safeTransferETH(msg.sender, msg.value - amountETH);
  }

  // **** REMOVE LIQUIDITY ****
  function removeLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
  ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
    address pair = pairFor(tokenA, tokenB, stable);
    require(IPair(pair).transferFrom(msg.sender, pair, liquidity), "Equalizer Router: transfer failed"); // send liquidity to pair
    (uint256 amount0, uint256 amount1) = IPair(pair).burn(to);
    (address token0, ) = sortTokens(tokenA, tokenB);
    (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
    require(amountA >= amountAMin, "Equalizer Router: INSUFFICIENT_A_AMOUNT");
    require(amountB >= amountBMin, "Equalizer Router: INSUFFICIENT_B_AMOUNT");
  }

  function removeLiquidityETH(
    address token,
    bool stable,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline
  ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
    (amountToken, amountETH) = removeLiquidity(
      token,
      address(weth),
      stable,
      liquidity,
      amountTokenMin,
      amountETHMin,
      address(this),
      deadline
    );
    _safeTransfer(token, to, amountToken);
    weth.withdraw(amountETH);
    _safeTransferETH(to, amountETH);
  }

  function removeLiquidityWithPermit(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline,
    bool approveMax,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 amountA, uint256 amountB) {
    address pair = pairFor(tokenA, tokenB, stable);
    {
      uint256 value = approveMax ? type(uint).max : liquidity;
      IPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
    }

    (amountA, amountB) = removeLiquidity(tokenA, tokenB, stable, liquidity, amountAMin, amountBMin, to, deadline);
  }

  function removeLiquidityETHWithPermit(
    address token,
    bool stable,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline,
    bool approveMax,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 amountToken, uint256 amountETH) {
    address pair = pairFor(token, address(weth), stable);
    uint256 value = approveMax ? type(uint).max : liquidity;
    IPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
    (amountToken, amountETH) = removeLiquidityETH(token, stable, liquidity, amountTokenMin, amountETHMin, to, deadline);
  }

  // **** SWAP ****
  /// @dev requires the initial amount to have already been sent to the first pair
  function _swap(uint256[] memory amounts, Route[] memory routes, address _to) internal virtual {
    for (uint256 i = 0; i < routes.length; ++i) {
      (address token0, ) = sortTokens(routes[i].from, routes[i].to);
      uint256 amountOut = amounts[i + 1];
      (uint256 amount0Out, uint256 amount1Out) = routes[i].from == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
      address to = i < routes.length - 1 ? pairFor(routes[i + 1].from, routes[i + 1].to, routes[i + 1].stable) : _to;
      IPair(pairFor(routes[i].from, routes[i].to, routes[i].stable)).swap(amount0Out, amount1Out, to, new bytes(0));
    }
  }

  function swapExactTokensForTokensSimple(
    uint256 amountIn,
    uint256 amountOutMin,
    address tokenFrom,
    address tokenTo,
    bool stable,
    address to,
    uint256 deadline
  ) external ensure(deadline) returns (uint256[] memory amounts) {
    Route[] memory routes = new Route[](1);
    routes[0].from = tokenFrom;
    routes[0].to = tokenTo;
    routes[0].stable = stable;
    amounts = getAmountsOut(amountIn, routes);
    require(amounts[amounts.length - 1] >= amountOutMin, "Equalizer Router: INSUFFICIENT_OUTPUT_AMOUNT");
    _safeTransferFrom(routes[0].from, msg.sender, pairFor(routes[0].from, routes[0].to, routes[0].stable), amounts[0]);
    _swap(amounts, routes, to);
  }

  function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external ensure(deadline) returns (uint256[] memory amounts) {
    amounts = getAmountsOut(amountIn, routes);
    require(amounts[amounts.length - 1] >= amountOutMin, "Equalizer Router: INSUFFICIENT_OUTPUT_AMOUNT");
    _safeTransferFrom(routes[0].from, msg.sender, pairFor(routes[0].from, routes[0].to, routes[0].stable), amounts[0]);
    _swap(amounts, routes, to);
  }

  function swapExactETHForTokens(
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external payable ensure(deadline) returns (uint256[] memory amounts) {
    require(routes[0].from == address(weth), "Equalizer Router: INVALID_PATH");
    amounts = getAmountsOut(msg.value, routes);
    require(amounts[amounts.length - 1] >= amountOutMin, "Equalizer Router: INSUFFICIENT_OUTPUT_AMOUNT");
    weth.deposit{value: amounts[0]}();
    assert(weth.transfer(pairFor(routes[0].from, routes[0].to, routes[0].stable), amounts[0]));
    _swap(amounts, routes, to);
  }

  function swapExactTokensForETH(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external ensure(deadline) returns (uint256[] memory amounts) {
    require(routes[routes.length - 1].to == address(weth), "Equalizer Router: INVALID_PATH");
    amounts = getAmountsOut(amountIn, routes);
    require(amounts[amounts.length - 1] >= amountOutMin, "Equalizer Router: INSUFFICIENT_OUTPUT_AMOUNT");
    _safeTransferFrom(routes[0].from, msg.sender, pairFor(routes[0].from, routes[0].to, routes[0].stable), amounts[0]);
    _swap(amounts, routes, address(this));
    weth.withdraw(amounts[amounts.length - 1]);
    _safeTransferETH(to, amounts[amounts.length - 1]);
  }

  function UNSAFE_swapExactTokensForTokens(
    uint256[] memory amounts,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external ensure(deadline) returns (uint256[] memory) {
    _safeTransferFrom(routes[0].from, msg.sender, pairFor(routes[0].from, routes[0].to, routes[0].stable), amounts[0]);
    _swap(amounts, routes, to);
    return amounts;
  }

  /***************************************************************************************************************************
   ***************************************************************************************************************************
   ** Experimental Extension [ftm.guru/solidly/BaseV1Router02]
   ***************************************************************************************************************************
   */

  // **** REMOVE LIQUIDITY (supporting fee-on-transfer tokens)****
  function removeLiquidityETHSupportingFeeOnTransferTokens(
    address token,
    bool stable,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline
  ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
    (amountToken, amountETH) = removeLiquidity(
      token,
      address(weth),
      stable,
      liquidity,
      amountTokenMin,
      amountETHMin,
      address(this),
      deadline
    );
    _safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
    weth.withdraw(amountETH);
    _safeTransferETH(to, amountETH);
  }

  function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
    address token,
    bool stable,
    uint256 liquidity,
    uint256 amountTokenMin,
    uint256 amountETHMin,
    address to,
    uint256 deadline,
    bool approveMax,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 amountToken, uint256 amountETH) {
    address pair = pairFor(token, address(weth), stable);
    uint256 value = approveMax ? type(uint).max : liquidity;
    IPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
    (amountToken, amountETH) = removeLiquidityETHSupportingFeeOnTransferTokens(
      token,
      stable,
      liquidity,
      amountTokenMin,
      amountETHMin,
      to,
      deadline
    );
  }

  // **** SWAP (supporting fee-on-transfer tokens) ****
  // requires the initial amount to have already been sent to the first pair
  function _swapSupportingFeeOnTransferTokens(Route[] calldata routes, address _to) internal virtual {
    for (uint256 i; i < routes.length; ++i) {
      (address input, address output) = (routes[i].from, routes[i].to);
      (address token0, ) = sortTokens(input, output);
      IPair pair = IPair(pairFor(routes[i].from, routes[i].to, routes[i].stable));
      uint256 amountInput;
      uint256 amountOutput;
      {
        // scope to avoid stack too deep errors
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        (uint256 reserveInput, ) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        amountInput = IERC20(input).balanceOf(address(pair)) - (reserveInput);
        (amountOutput, ) = getAmountOut(amountInput, input, output);
      }
      (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));
      address to = i < routes.length - 1 ? pairFor(routes[i + 1].from, routes[i + 1].to, routes[i + 1].stable) : _to;
      pair.swap(amount0Out, amount1Out, to, new bytes(0));
    }
  }

  function swapExactTokensForTokensSupportingFeeOnTransferTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external ensure(deadline) {
    _safeTransferFrom(routes[0].from, msg.sender, pairFor(routes[0].from, routes[0].to, routes[0].stable), amountIn);
    uint256 balanceBefore = IERC20(routes[routes.length - 1].to).balanceOf(to);
    _swapSupportingFeeOnTransferTokens(routes, to);
    require(
      IERC20(routes[routes.length - 1].to).balanceOf(to) - (balanceBefore) >= amountOutMin,
      "Equalizer Router: INSUFFICIENT_OUTPUT_AMOUNT"
    );
  }

  function swapExactETHForTokensSupportingFeeOnTransferTokens(
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external payable ensure(deadline) {
    require(routes[0].from == address(weth), "Equalizer Router: INVALID_PATH");
    uint256 amountIn = msg.value;
    weth.deposit{value: amountIn}();
    assert(weth.transfer(pairFor(routes[0].from, routes[0].to, routes[0].stable), amountIn));
    uint256 balanceBefore = IERC20(routes[routes.length - 1].to).balanceOf(to);
    _swapSupportingFeeOnTransferTokens(routes, to);
    require(
      IERC20(routes[routes.length - 1].to).balanceOf(to) - (balanceBefore) >= amountOutMin,
      "Equalizer Router: INSUFFICIENT_OUTPUT_AMOUNT"
    );
  }

  function swapExactTokensForETHSupportingFeeOnTransferTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    Route[] calldata routes,
    address to,
    uint256 deadline
  ) external ensure(deadline) {
    require(routes[routes.length - 1].to == address(weth), "Equalizer Router: INVALID_PATH");
    _safeTransferFrom(routes[0].from, msg.sender, pairFor(routes[0].from, routes[0].to, routes[0].stable), amountIn);
    _swapSupportingFeeOnTransferTokens(routes, address(this));
    uint256 amountOut = IERC20(address(weth)).balanceOf(address(this));
    require(amountOut >= amountOutMin, "Equalizer Router: INSUFFICIENT_OUTPUT_AMOUNT");
    weth.withdraw(amountOut);
    _safeTransferETH(to, amountOut);
  }

  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, "TransferHelper: ETH_TRANSFER_FAILED");
  }

  function _safeTransfer(address token, address to, uint256 value) internal {
    require(token.code.length > 0, "Equalizer Router: invalid token");
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), "Equalizer Router: token transfer failed");
  }

  function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
    require(token.code.length > 0, "Equalizer Router: invalid token");
    (bool success, bytes memory data) = token.call(
      abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
    );
    require(success && (data.length == 0 || abi.decode(data, (bool))), "Equalizer Router: token transfer failed");
  }
}
