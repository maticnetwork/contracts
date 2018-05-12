pragma solidity ^0.4.23;

import "./lib/SafeMath.sol";
import "./lib/MerklePatriciaProof.sol";
import "./lib/Merkle.sol";
import "./lib/RLP.sol";
import "./lib/BytesLib.sol";
import "./lib/RLPEncode.sol";
import "./mixin/Ownable.sol";
import "./token/ERC20.sol";
import "./token/WETH.sol";

import "./StakeManagerInterface.sol";


contract RootChain is Ownable {
  using SafeMath for uint256;
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // bytes32 constants
  // keccak256('\x2e\x1a\x7d\x4d')
  bytes32 constant public withdrawSignature = '\x00\x73\x5d\xe6\x07\x24\xe5\xf7\x8e\x79\x34\x0a\x43\x7f\x3e\x86\x1f\x2e\xfd\xec\x60\x47\xc2\xcb\xf4\x97\xc3\x47\x07\xc9\x59\xbb';
  // keccak256('Withdraw(address,address,uint256)')
  bytes32 constant public withdrawEventSignature = '\x9b\x1b\xfa\x7f\xa9\xee\x42\x0a\x16\xe1\x24\xf7\x94\xc3\x5a\xc9\xf9\x04\x72\xac\xc9\x91\x40\xeb\x2f\x64\x47\xc7\x14\xca\xd8\xeb';
  // chain identifier
  // keccak256('Matic Network v0.0.1-beta.1')
  bytes32 public chain = '\x29\x84\x30\x1e\x97\x62\xb1\x4f\x38\x31\x41\xec\x6a\x9a\x76\x61\x40\x91\x03\x73\x7c\x37\xbb\xa9\xe0\xa2\x2b\xe2\x6d\x63\x48\x6d';

  // WETH address
  address public wethToken;

  // stake interface
  StakeManagerInterface public stakeManager;

  // mapping for (root token => child token)
  mapping(address => address) public tokens;

  // header block
  struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
  }

  // list of header blocks (address => header block object)
  mapping(uint256 => HeaderBlock) public headerBlocks;

  // current header block number
  uint256 public currentHeaderBlock;

  // current deposit count
  uint256 public depositCount;

  // Constructor
  constructor (address _stakeManager) public {
    setStakeManager(_stakeManager);
  }

  // withdraws
  mapping(bytes32 => bool) public withdraws;

  //
  // Events
  //
  event TokenMapped(address indexed rootToken, address indexed childToken);
  event Deposit(address indexed user, address indexed token, uint256 amount, uint256 depositCount);
  event Withdraw(address indexed user, address indexed token, uint256 amount);
  event NewHeaderBlock(
    address indexed proposer,
    uint256 number,
    uint256 start,
    uint256 end,
    bytes32 root
  );

  //
  // Modifiers
  //
  /**
   * @dev Throws if deposit is not valid
   */
  modifier validateDeposit(address token, uint256 value) {
    // token must be supported
    require(tokens[token] != address(0x0));

    // token amount must be greater than 0
    require(value > 0);

    _;
  }

  // deposit ETH by sending to this contract
  function () public payable {
    depositEthers(msg.sender);
  }

  //
  // Admin functions
  //
  // map child token to root token
  function mapToken(address rootToken, address childToken) public onlyOwner {
    tokens[rootToken] = childToken;
    emit TokenMapped(rootToken, childToken);
  }

  // set WETH
  function setWETHToken(address _token) public onlyOwner {
    wethToken = _token;
  }

  //
  // PoS functions
  //
  function setStakeManager(address _stakeManager) public onlyOwner {
    require(_stakeManager != 0x0);
    stakeManager = StakeManagerInterface(_stakeManager);
  }

  function submitHeaderBlock(bytes32 root, uint256 end, bytes sigs) public {
    uint256 start = currentChildBlock();
    if (start > 0) {
      start = start.add(1);
    }

    // Make sure we are adding blocks
    require(end > start);

    // Make sure enough validators sign off on the proposed header root
    require(
      stakeManager.checkSignatures(root, start, end, sigs) >= stakeManager.validatorThreshold()
    );

    // Add the header root
    HeaderBlock memory headerBlock = HeaderBlock({
      root: root,
      start: start,
      end: end,
      createdAt: block.timestamp
    });
    headerBlocks[currentHeaderBlock] = headerBlock;
    emit NewHeaderBlock(
      msg.sender,
      currentHeaderBlock,
      headerBlock.start,
      headerBlock.end,
      root
    );
    currentHeaderBlock = currentHeaderBlock.add(1);

    // TODO add rewards

    // finalize commit
    stakeManager.finalizeCommit(msg.sender);
  }

  function currentChildBlock() public view returns(uint256) {
    if (currentHeaderBlock != 0) {
      return headerBlocks[currentHeaderBlock.sub(1)].end;
    }

    return 0;
  }

  //
  // User functions
  //
  // token fallback for ERC223
  function tokenFallback(address _sender, uint256 _value, bytes) public validateDeposit(msg.sender, _value) {
    address token = msg.sender;

    // generate deposit event and udpate counter
    _depositEvent(token, _sender, _value);
  }

  // deposit ethers
  function depositEthers() public payable {
    depositEthers(msg.sender);
  }

  // deposit ethers
  function depositEthers(address user) public payable validateDeposit(wethToken, msg.value) {
    // transfer ethers to this contract (through WETH)
    WETH t = WETH(wethToken);
    t.deposit.value(msg.value)();

    // generate deposit event and udpate counter
    _depositEvent(wethToken, user, msg.value);
  }

  // deposit tokens
  function deposit(address token, uint256 amount) public {
    deposit(token, msg.sender, amount);
  }

  // deposit tokens for another user
  function deposit(address token, address user, uint256 amount) public validateDeposit(token, amount) {
    // transfer tokens to current contract
    ERC20 t = ERC20(token);
    require(t.transferFrom(user, address(this), amount));

    // generate deposit event and udpate counter
    _depositEvent(token, user, amount);
  }

  function _depositEvent(address token, address user, uint256 amount) internal {
    // broadcast deposit event
    emit Deposit(user, token, amount, depositCount);

    // increase deposit counter
    depositCount = depositCount.add(1);
  }

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
    // check if not already withdrawn
    require(withdraws[txRoot] == false);

    // set flag for withdraw competed
    withdraws[txRoot] = true;

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

    _withdraw(
      headerNumber,
      headerProof,
      blockNumber,
      blockTime,

      txRoot,
      receiptRoot,
      rootToken,
      receiptAmount
    );
  }

  //
  // Internal functions
  //
  function _withdraw(
    uint256 headerNumber,
    bytes headerProof,
    uint256 blockNumber,
    uint256 blockTime,

    bytes32 txRoot,
    bytes32 receiptRoot,

    address rootToken,
    uint256 amount
  ) internal {
    // check block header
    require(
      keccak256(
        blockNumber,
        blockTime,
        txRoot,
        receiptRoot
      ).checkMembership(
        blockNumber - headerBlocks[headerNumber].start,
        headerBlocks[headerNumber].root,
        headerProof
      )
    );

    if (rootToken == wethToken) {
      // transfer ETH to msg.sender if `rootToken` is `wethToken`
      WETH(wethToken).withdraw(amount, msg.sender);
    } else {
      // transfer tokens to current contract
      ERC20(rootToken).transfer(msg.sender, amount);
    }

    // broadcast deposit events
    emit Withdraw(msg.sender, rootToken, amount);
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
    rawTx[6] = '\x0d'; // 13
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

  function _getV(bytes v, uint8 chainId) internal pure returns (uint8) {
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
}
