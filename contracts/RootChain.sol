pragma solidity ^0.4.18;

import "./lib/SafeMath.sol";
import "./lib/ECVerify.sol";
import "./lib/MerklePatriciaProof.sol";
import "./lib/Merkle.sol";
import "./lib/RLP.sol";
import "./lib/BytesLib.sol";
import "./lib/RLPEncode.sol";
import "./mixin/Ownable.sol";

import "./token/ERC20.sol";

contract RootChain is Ownable {
  using SafeMath for uint256;
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // bytes32 constants
  bytes32 constant public withdrawSignature = keccak256('\x2e\x1a\x7d\x4d');
  bytes32 constant public withdrawEventSignature = keccak256('Withdraw(address,address,uint256)');

  // chain identifier
  bytes32 public chain = keccak256('Matic Network v0.0.1-beta.1');

  // stake token address
  address public stakeToken;

  // mapping for (root token => child token)
  mapping(address => address) public tokens;

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
  event TokenMapped(address indexed rootToken, address indexed childToken);
  event ThresholdChange(uint256 newThreshold, uint256 oldThreshold);
  event Deposit(address indexed user, address indexed token, uint256 amount);
  event Withdraw(address indexed user, address indexed token, uint256 amount);
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
    ThresholdChange(newThreshold, validatorThreshold);
    validatorThreshold = newThreshold;
  }

  // map child token to root token
  function mapToken(address rootToken, address childToken) public onlyOwner {
    tokens[rootToken] = childToken;
    TokenMapped(rootToken, childToken);
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
  // PoS functions
  //

  function submitHeaderBlock(bytes32 root, uint256 end, bytes sigs) public {
    uint256 start = currentChildBlock();
    if (start > 0) {
      start = start.add(1);
    }

    // Make sure we are adding blocks
    require(end > start);

    // Make sure enough validators sign off on the proposed header root
    require(
      checkSignatures(root, start, end, sigs) >= validatorThreshold
    );

    // Add the header root
    HeaderBlock memory headerBlock = HeaderBlock({
      root: root,
      start: start,
      end: end,
      createdAt: block.timestamp
    });
    headerBlocks[currentHeaderBlock] = headerBlock;
    currentHeaderBlock = currentHeaderBlock.add(1);

    // Calculate the reward and issue it
    // uint256 r = reward.base + reward.a * (end - start);
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
    if (currentHeaderBlock != 0) {
      return headerBlocks[currentHeaderBlock.sub(1)].end;
    }

    return 0;
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

      // check if signer is stacker and not proposer
      if (isStaker(signer) && signer != getProposer()) {
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

  event LogBytes(uint256 key, bytes value);
  event LogBytes32(uint256 key, bytes32 value);
  event LogInt(uint256 key, uint256 value);
  event LogBool(uint256 key, bool value);
  event LogAddress(uint256 key, address value);
  // withdraw tokens
  function withdraw(
    uint256 headerNumber,
    bytes headerProof,

    uint256 blockNumber,
    uint256 blockTime,
    bytes32 txRoot,
    bytes32 receiptRoot,
    bytes path,

    bytes txBytes,
    bytes txProof,

    bytes receiptBytes,
    bytes receiptProof
  ) public {
    // process receipt
    var (rootToken, receiptAmount) = _processWithdrawReceipt(
      receiptBytes,
      path,
      receiptProof,
      receiptRoot
    );

    // process withdraw tx
    _processWithdrawTx(
      txBytes,
      path,
      txProof,
      txRoot,

      rootToken,
      receiptAmount
    );

    // check header block value
    /* _checkBlockHeader(
      keccak256(blockNumber, blockTime, txRoot, receiptRoot),
      headerProof,
      blockNumber,
      headerNumber
    ); */

    // withdraw root tokens
    // _withdraw(rootToken, amount);
  }

  //
  // Internal functions
  //

  function _withdraw(address token, uint256 amount) internal {
    // transfer tokens to current contract
    ERC20 t = ERC20(token);
    t.transfer(msg.sender, amount)

    // broadcast deposit events
    Withdraw(msg.sender, token, amount);
  }

  function _processWithdrawTx(
    bytes txBytes,
    bytes path,
    bytes txProof,
    bytes32 txRoot,

    address rootToken,
    uint256 amount
  ) internal view {
    // check tx
    RLP.RLPItem[] memory txList = txBytes.toRLPItem().toList();
    require(txList.length == 9);

    // check mapped root<->child token
    require(tokens[rootToken] == txList[3].toAddress());

    // Data check
    require(txList[5].toData().length == 36);
    // '0x2e1a7d4d' = sha3('withdraw(uint256)')
    require(keccak256(BytesLib.slice(txList[5].toData(), 0, 4)) == withdrawSignature);
    // check amount
    require(amount > 0 && amount == BytesLib.toUint(txList[5].toData(), 4));

    // Make sure this tx is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(txBytes, path, txProof, txRoot) == true);

    // raw tx
    bytes[] memory rawTx = new bytes[](9);
    for (uint8 i = 0; i <= 5; i++) {
      rawTx[i] = txList[i].toData();
    }
    rawTx[4] = hex"";
    rawTx[6] = '\x0d'; // '\x3e'
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover sender from v, r and s
    require(
      msg.sender == ecrecover(
        keccak256(RLPEncode.encodeList(rawTx)),
        _getV(txList[6].toData(), 13),
        txList[7].toBytes32(),
        txList[8].toBytes32()
      )
    );
  }

  function _getV(bytes v, uint8 chainId) internal constant returns (uint8) {
    if (chainId > 0) {
      return uint8(BytesLib.toUint(BytesLib.leftPad(v), 0) - (chainId * 2) - 8);
    } else {
      return uint8(BytesLib.toUint(BytesLib.leftPad(v), 0));
    }
  }

  function _processWithdrawReceipt(
    bytes receiptBytes,
    bytes path,
    bytes receiptProof,
    bytes32 receiptRoot
  ) internal view returns (address rootToken, uint256 amount) {
    // check receipt
    RLP.RLPItem[] memory items = receiptBytes.toRLPItem().toList();
    require(items.length == 4);

    // [3][0] -> [child token address, [withdrawEventSignature, root token address, sender], amount]
    items = items[3].toList()[0].toList();
    require(items.length == 3);
    address childToken = items[0].toAddress(); // child token address
    amount = items[2].toUint(); // amount

    // [3][0][1] -> [withdrawEventSignature, root token address, sender]
    items = items[1].toList();
    require(items.length == 3);
    require(items[0].toBytes32() == withdrawEventSignature); // check for withdraw event signature

    // check if root token is mapped to child token
    rootToken = BytesLib.toAddress(items[1].toData(), 12); // fetch root token address
    require(tokens[rootToken] == childToken);

    // check if sender is valid
    require(msg.sender == BytesLib.toAddress(items[2].toData(), 12));

    // Make sure this receipt is the value on the path via a MerklePatricia proof
    require(MerklePatriciaProof.verify(receiptBytes, path, receiptProof, receiptRoot) == true);
  }

  function _checkBlockHeader(
    bytes32 value,
    bytes proof,
    uint256 blockNumber,
    uint256 headerNumber
  ) internal {
    HeaderBlock memory h = headerBlocks[headerNumber];
    require(value.checkMembership(blockNumber - h.start, h.root, proof));
  }
}
