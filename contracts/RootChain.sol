pragma solidity ^0.4.23;

import "./lib/SafeMath.sol";
import "./lib/MerklePatriciaProof.sol";
import "./lib/Merkle.sol";
import "./lib/RLP.sol";
import "./lib/BytesLib.sol";
import "./lib/Common.sol";
import "./lib/RLPEncode.sol";
import "./mixin/Ownable.sol";
import "./mixin/RootChainValidator.sol";
import "./token/ERC20.sol";
import "./token/WETH.sol";

import "./StakeManagerInterface.sol";
import "./RootChainInterface.sol";


contract RootChain is Ownable {
  using SafeMath for uint256;
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // bytes32 constants
  // keccak256(0x2e1a7d4d)
  bytes32 constant public withdrawSignature = 0x00735de60724e5f78e79340a437f3e861f2efdec6047c2cbf497c34707c959bb;
  // keccak256('Withdraw(address,address,uint256)')
  bytes32 constant public withdrawEventSignature = 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb;
  // chain identifier
  // keccak256('Matic Network v0.0.1-beta.1')
  bytes32 public chain = 0x2984301e9762b14f383141ec6a9a7661409103737c37bba9e0a22be26d63486d;
  // networkId
  bytes public networkId = '\x0d';

  // WETH address
  address public wethToken;

  // stake interface
  StakeManagerInterface public stakeManager;
  mapping(address => bool) public validatorContracts;

  // mapping for (root token => child token)
  mapping(address => address) public tokens;
  // mapping for (child token => root token)
  mapping(address => address) public reverseTokens;
  // child chain contract
  address public childChainContract;

  // header block
  struct HeaderBlock {
    bytes32 root;
    uint256 start;
    uint256 end;
    uint256 createdAt;
  }

  // deposit block
  struct DepositBlock {
    uint256 header;
    address owner;
    address token;
    uint256 amount;
  }

  // list of header blocks (address => header block object)
  mapping(uint256 => HeaderBlock) public headerBlocks;

  // list of deposits
  mapping(uint256 => DepositBlock) public deposits;

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
  event ChildChainChanged(address indexed previousChildChain, address indexed newChildChain);
  event TokenMapped(address indexed rootToken, address indexed childToken);
  event ValidatorAdded(address indexed validator, address indexed from);
  event ValidatorRemoved(address indexed validator, address indexed from);
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

  // Checks if address is contract or not
  modifier notContract(address user) {
    require(Common.isContract(user) == false);
    _;
  }

  // Checks is msg.sender is valid validator
  modifier isValidator(address _address) {
    require(validatorContracts[_address] == true);
    _;
  }

  // deposit ETH by sending to this contract
  function () public payable {
    depositEthers(msg.sender);
  }

  //
  // Admin functions
  //
  // change child chain contract
  function setChildContract(address newChildChain) public onlyOwner {
    require(newChildChain != address(0));
    emit ChildChainChanged(childChainContract, newChildChain);
    childChainContract = newChildChain;
  }

  // map child token to root token
  function mapToken(address rootToken, address childToken) public onlyOwner {
    tokens[rootToken] = childToken;
    reverseTokens[childToken] = rootToken;
    emit TokenMapped(rootToken, childToken);
  }

  // set WETH
  function setWETHToken(address _token) public onlyOwner {
    wethToken = _token;
  }

  // add validator
  function addValidator(address _validator) public onlyOwner {
    require(_validator != address(0) && validatorContracts[_validator] != true);
    emit ValidatorAdded(_validator, msg.sender);
    validatorContracts[_validator] = true;
  }

  // remove validator
  function removeValidator(address _validator) public onlyOwner {
    require(validatorContracts[_validator] == true);
    emit ValidatorAdded(_validator, msg.sender);
    delete validatorContracts[_validator];
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

  //
  // Header block
  //

  function currentChildBlock() public view returns(uint256) {
    if (currentHeaderBlock != 0) {
      return headerBlocks[currentHeaderBlock.sub(1)].end;
    }

    return 0;
  }

  function getHeaderBlock(uint256 headerNumber) public view returns (
    bytes32 root,
    uint256 start,
    uint256 end,
    uint256 createdAt
  ) {
    root = headerBlocks[headerNumber].root;
    start = headerBlocks[headerNumber].start;
    end = headerBlocks[headerNumber].end;
    createdAt = headerBlocks[headerNumber].createdAt;
  }

  //
  // Deposit block
  //
  function getDepositBlock(uint256 depositCount) public view returns (
    uint256 header,
    address owner,
    address token,
    uint256 amount
  ) {
    header = deposits[depositCount].header;
    owner = deposits[depositCount].owner;
    token = deposits[depositCount].token;
    amount = deposits[depositCount].amount;
  }

  //
  // User functions
  //
  // token fallback for ERC223
  function tokenFallback(address _sender, uint256 _value, bytes)
    public
    validateDeposit(msg.sender, _value)
  {
    address token = msg.sender;

    // generate deposit event and udpate counter
    _depositEvent(token, _sender, _value);
  }

  // deposit ethers
  function depositEthers() public payable {
    depositEthers(msg.sender);
  }

  // deposit ethers
  function depositEthers(
    address user
  ) public payable notContract(user) validateDeposit(wethToken, msg.value) {
    // transfer ethers to this contract (through WETH)
    WETH t = WETH(wethToken);
    t.deposit.value(msg.value)();

    // generate deposit event and udpate counter
    _depositEvent(wethToken, user, msg.value);
  }

  // deposit tokens
  // function deposit(address token, uint256 amount) public {
  //   deposit(token, msg.sender, amount);
  // }

  // deposit tokens for another user
  function deposit(
    address token,
    address user,
    uint256 amount
  ) public notContract(user) validateDeposit(token, amount) {
    // transfer tokens to current contract
    ERC20 t = ERC20(token);
    require(t.transferFrom(user, address(this), amount));

    // generate deposit event and udpate counter
    _depositEvent(token, user, amount);
  }

  function _depositEvent(address token, address user, uint256 amount) internal {
    // broadcast deposit event
    emit Deposit(user, token, amount, depositCount);

    // add deposit into deposits
    deposits[depositCount] = DepositBlock({
      header: currentHeaderBlock,
      owner: user,
      token: token,
      amount: amount
    });

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
    rawTx[6] = networkId;
    rawTx[7] = hex"";
    rawTx[8] = hex"";

    // recover sender from v, r and s
    require(
      msg.sender == ecrecover(
        keccak256(RLPEncode.encodeList(rawTx)),
        Common.getV(txList[6].toData(), Common.toUint8(networkId)),
        txList[7].toBytes32(),
        txList[8].toBytes32()
      )
    );
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

  //
  // Slashing conditions
  //

  // slash stakers if fraud is detected
  function slash() public isValidator(msg.sender) {
    // TODO pass block/proposer
  }
}
