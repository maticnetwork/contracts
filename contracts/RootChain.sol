pragma solidity 0.4.18;

import './lib/SafeMath.sol';
import "./lib/ECVerify.sol";
import './lib/RLP.sol';
import "./mixin/Ownable.sol";

import "./token/ERC20.sol";

contract RootChain is Ownable {
  using SafeMath for uint256;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // chain identifier (protection against replay attacks)
  bytes32 public chain = keccak256('Matic Network v0.0.1-beta.1');

  // stake token address
  address public stakeToken;

  // The randomness seed of the epoch.
  // This is used to determine the proposer and the validator pool
  bytes32 public epochSeed = keccak256(block.difficulty + block.number + now);

  // header block
  struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
  }

  mapping(uint256 => HeaderBlock) public headerBlocks;
  uint256 public currentHeaderBlock;

  // validator threshold
  uint256 public validatorThreshold = 0;

  // Pool of stakers and validators
  struct Stake {
    uint256 amount;
    address staker;
  }

  mapping(address => uint256) public stakers;
  Stake[] public stakeList;
  uint256 public totalStake;

  // Constructor
  function RootChain(address token) public {
    stakeToken = token;
  }

  //
  // Events
  //
  event Deposit(address indexed user, address indexed token, uint256 amount);
  event NewHeaderBlock(
    address indexed proposer,
    uint256 indexed start,
    uint256 indexed end,
    bytes32 root
  );

  //
  // Modifier
  //

  // only staker
  modifier onlyStaker() {
    require(isStaker(msg.sender));
    _;
  }

  // Change the number of validators required to allow a passed header root
  function updateValidatorThreshold(uint256 newThreshold) public onlyOwner {
    validatorThreshold = newThreshold;
  }

  //
  // Staker functions
  //
  function stake(uint256 amount) public {
    require(amount > 0);

    ERC20 t = ERC20(stakeToken);
    require(t.transferFrom(msg.sender, address(this), amount));

    // check staker is present or not
    if (stakers[msg.sender] == 0) {
      // actual staker cannot be on index 0
      if (stakeList.length == 0) {
        stakeList.push(Stake({
          amount: 0,
          staker: address(0x0)
        }));
      }

      // add new stake
      stakeList.push(Stake({
        amount: 0,
        staker: msg.sender
      }));
      stakers[msg.sender] = stakeList.length - 1;
    }

    // add amount
    stakeList[stakers[msg.sender]].amount = getStake(msg.sender).add(amount);

    // update total stake
    totalStake = totalStake.add(amount);
  }

  // Remove stake
  function destake(uint256 amount) public onlyStaker {
    uint256 currentStake = getStake(msg.sender);
    require(amount <= currentStake);
    stakeList[stakers[msg.sender]].amount = currentStake.sub(amount);

    // reduce total stake
    totalStake = totalStake.sub(amount);

    // transfer stake amount
    ERC20 t = ERC20(stakeToken);
    t.transfer(msg.sender, amount);
  }

  //
  // User functions
  //

  // Any user can deposit
  function deposit(address token, uint256 amount) public {
    // transfer tokens to current contract
    ERC20 t = ERC20(token);
    require(t.transferFrom(msg.sender, address(this), amount));

    // broadcast deposit events
    Deposit(msg.sender, token, amount);
  }

  function submitHeaderBlock(bytes32 root, uint256 end, bytes sigs) public {
    uint256 lastBlock = currentChildBlock();

    // Make sure we are adding blocks
    require(end > lastBlock.add(1));

    // Make sure enough validators sign off on the proposed header root
    require(
      checkSignatures(root, lastBlock.add(1), end, sigs) >= validatorThreshold
    );

    // Add the header root
    HeaderBlock memory headerBlock = HeaderBlock({
      root: root,
      start: lastBlock.add(1),
      end: end,
      createdAt: block.timestamp
    });
    headerBlocks[currentHeaderBlock] = headerBlock;
    currentHeaderBlock = currentHeaderBlock.add(1);

    // Calculate the reward and issue it
    // uint256 r = reward.base + reward.a * (end - lastBlock[chainId]);
    // If we exceed the max reward, anyone can propose the header root
    // if (r > maxReward) {
    //   r = maxReward;
    // } else {
    //   require(msg.sender == getProposer());
    // }
    // msg.sender.transfer(r);

    NewHeaderBlock(
      msg.sender,
      headerBlock.start,
      headerBlock.end,
      root
    );

    // set epoch seed
    epochSeed = keccak256(block.difficulty + block.number + now);
  }

  function currentChildBlock() public view returns(uint256) {
    return headerBlocks[currentHeaderBlock].end;
  }

  // Sample a proposer. Likelihood of being chosen is proportional to stake size.
  function getProposer() public constant returns (address) {
    // Convert the seed to an index
    uint256 target = uint256(epochSeed) % totalStake;
    // Index of stake list
    uint64 i = 1;
    // Total stake
    uint256 sum = 0;
    while (sum < target) {
      sum += stakeList[i].amount;
      i += 1;
    }

    return stakeList[i - 1].staker;
  }

  function getStake(address a) public view returns (uint256) {
    return stakeList[stakers[a]].amount;
  }

  function getStakeIndex(address a) public view returns (uint256) {
    return stakers[a];
  }

  function isStaker(address a) public view returns (bool) {
    return stakeList[stakers[a]].amount > 0;
  }

  function checkSignatures(
    bytes32 root,
    uint256 start,
    uint256 end,
    bytes sigs
  ) public view returns (uint256) {
    // create hash
    bytes32 h = keccak256(chain, root, start, end);

    // total signers
    uint256 totalSigners = 0;

    // get sig list
    var sigList = sigs.toRLPItem().toList();
    address[] memory uniqueStakers = new address[](sigList.length);
    for (uint64 i = 0; i < sigList.length; i += 1) {
      address signer = ECVerify.ecrecovery(h, sigList[i].toData());
      bool duplicate = false;

      if (isStaker(signer)) { // check if signer is stacker
        for (uint64 j = 0; j < i; j += 1) {
          if (uniqueStakers[j] == signer) {
            duplicate = true;
            break;
          }
        }
      }

      if (duplicate == false) {
        uniqueStakers[i] = signer;
        totalSigners++;
      }
    }

    return totalSigners;
  }
}
