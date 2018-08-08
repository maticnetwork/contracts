pragma solidity ^0.4.24;

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

import "./PriorityQueue.sol";
import "./StakeManager.sol";


contract RootChain is Ownable {
  using SafeMath for uint256;
  using Merkle for bytes32;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  // bytes32 constants
  // 0x2e1a7d4d = sha3('withdraw(uint256)')
  bytes4 constant public WITHDRAW_SIGNATURE = 0x2e1a7d4d;
  // chain identifier
  // keccak256('Matic Network v0.0.1-beta.1')
  bytes32 public chain = 0x2984301e9762b14f383141ec6a9a7661409103737c37bba9e0a22be26d63486d;
  // networkId
  bytes public networkId = "\x0d";

  // WETH address
  address public wethToken;

  // stake interface
  StakeManager public stakeManager;
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

  //
  // exits
  //

  struct PlasmaExit {
    address owner;
    address token;
    uint256 amount;
  }

  mapping (uint256 => PlasmaExit) public exits;
  mapping (address => address) public exitsQueues;

  // current withdraw count
  uint256 public withdrawCount;

  //
  // Constructor
  //

  constructor (address _stakeManager) public {
    setStakeManager(_stakeManager);
  }

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
    uint256 indexed number,
    uint256 start,
    uint256 end,
    bytes32 root
  );
  event ExitStarted(
    address indexed exitor,
    uint256 indexed utxoPos,
    address token,
    uint256 amount
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
    // check if token is not already mapped
    require(tokens[rootToken] == address(0));

    tokens[rootToken] = childToken;
    reverseTokens[childToken] = rootToken;
    emit TokenMapped(rootToken, childToken);

    // create exit queue
    exitsQueues[rootToken] = address(new PriorityQueue());
  }

  // set WETH
  function setWETHToken(address _token) public onlyOwner {
    wethToken = _token;

    // weth token queue
    exitsQueues[wethToken] = address(new PriorityQueue());
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
    stakeManager = StakeManager(_stakeManager);
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

  }

  //
  // Slashing conditions
  //

  // slash stakers if fraud is detected
  function slash() public isValidator(msg.sender) {
    // TODO pass block/proposer
  }

  //
  // Exit functions
  //

  /**
  * @dev Returns information about an exit.
  * @param _utxoPos Position of the UTXO in the chain.
  * @return A tuple representing the active exit for the given UTXO.
  */
  function getExit(uint256 _utxoPos)
    public
    view
    returns (address, address, uint256)
  {
    return (exits[_utxoPos].owner, exits[_utxoPos].token, exits[_utxoPos].amount);
  }


  /**
  * @dev Determines the next exit to be processed.
  * @param _token Asset type to be exited.
  * @return A tuple of the position and time when this exit can be processed.
  */
  function getNextExit(address _token)
    public
    view
    returns (uint256, uint256)
  {
    return PriorityQueue(exitsQueues[_token]).getMin();
  }

  /**
  * @dev Processes any exits that have completed the exit period.
  */
  function processExits(address _token) public {
    uint256 exitableAt;
    uint256 utxoPos;

    PriorityQueue exitQueue = PriorityQueue(exitsQueues[_token]);

    // Iterate while the queue is not empty.
    while (exitQueue.currentSize() > 0) {
      (exitableAt, utxoPos) = getNextExit(_token);

      // Check if this exit has finished its challenge period.
      if (exitableAt > block.timestamp){
        return;
      }

      // get withdraw block
      PlasmaExit memory currentExit = exits[utxoPos];

      // If an exit was successfully challenged, owner would be address(0).
      if (currentExit.owner != address(0)) {
        currentExit.owner.transfer(currentExit.amount);
        if (_token == wethToken) {
          // transfer ETH to msg.sender if `rootToken` is `wethToken`
          WETH(wethToken).withdraw(currentExit.amount, currentExit.owner);
        } else {
          // transfer tokens to current contract
          ERC20(_token).transfer(currentExit.owner, currentExit.amount);
        }

        // broadcast withdraw events
        emit Withdraw(currentExit.owner, _token, currentExit.amount);

        // Delete owner but keep amount to prevent another exit from the same UTXO.
        delete exits[utxoPos].owner;
      }

      // exit queue
      exitQueue.delMin();
    }
  }

  //
  // Internal functions
  //

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

  /**
  * @dev Adds an exit to the exit queue.
  * @param _utxoPos Position of the UTXO in the child chain (blockNumber, txIndex, oIndex)
  * @param _exitor Owner of the UTXO.
  * @param _token Token to be exited.
  * @param _amount Amount to be exited.
  * @param _createdAt Time when the UTXO was created.
  */
  function addExitToQueue(
    uint256 _utxoPos,
    address _exitor,
    address _token,
    uint256 _amount,
    uint256 _createdAt
  ) internal {
    // Check that we're exiting a known token.
    require(exitsQueues[_token] != address(0));

    // Calculate priority.
    uint256 exitableAt = Common.max(_createdAt + 2 weeks, block.timestamp + 1 weeks);

    // Check exit is valid and doesn't already exist.
    require(_amount > 0);
    require(exits[_utxoPos].amount == 0);

    PriorityQueue queue = PriorityQueue(exitsQueues[_token]);
    queue.insert(exitableAt, _utxoPos);

    // withdraw block
    exits[_utxoPos] = PlasmaExit({
      owner: _exitor,
      token: _token,
      amount: _amount
    });

    emit ExitStarted(msg.sender, _utxoPos, _token, _amount);
  }
}
