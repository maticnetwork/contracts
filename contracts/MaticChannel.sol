pragma solidity ^0.4.17;

import './token/StandardToken.sol';
import "./lib/ECVerify.sol";

contract MaticChannel {
  // owner of this channel
  address public owner;
  // matic address
  address public matic;

  // challenge period
  uint32 public challengePeriod;

  // order index for receiver (receiver => order index)
  mapping (address => uint256) public orderIndexes;

  // token managers (token => token manager)
  mapping (address => TokenManager) public tokenManagers;

  // Token manager
  struct TokenManager {
    uint32 settleBlock; // settlement block
    uint256 deposit; // total deposit
    uint256 closingBalance; // closing balance
  }

  // Events
  event Deposit(address indexed sender, address indexed token, uint256 balance);
  event Withdraw(address indexed receiver, address indexed token, bytes32 indexed orderId, uint256 balance);
  event SettlementRequested(address indexed owner, address indexed token, uint256 balance, uint32 settleBlock);
  event Settle(address indexed owner, address indexed token, uint256 balance);

  //
  // Modifier
  //

  // only owner
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * Constructor
   */
  function MaticChannel(address _owner, address _matic, uint32 _challengePeriod) public {
    require(_challengePeriod > 0);

    owner = _owner;
    matic = _matic;
    challengePeriod = _challengePeriod;
  }

  /// @dev Returns generate order id for given receiver
  /// @param receiver The address that receives tokens.
  /// @return Hash of the order id
  function generateOrderId (address receiver) public view returns (bytes32) {
    return keccak256(address(this), receiver, orderIndexes[receiver]);
  }

  /// @dev Returns a hash of the balance message needed to be signed by the sender.
  /// @param receiver The address that receives tokens.
  /// @param token Token address.
  /// @param orderId The order id which sender and receiver both can agree on.
  /// @param balance The amount of tokens owed by the sender to the receiver.
  /// @return Hash of the balance message.
  function getBalanceMessage(address receiver, address token, bytes32 orderId, uint256 balance) public view returns (bytes32) {
    // The variable names from below will be shown to the sender when signing
    // the balance proof, so they have to be kept in sync with the Dapp client.
    // The hashed strings should be kept in sync with this function's parameters
    // (variable names and types).
    // ! Note that EIP712 might change how hashing is done, triggering a
    // new contract deployment with updated code.
    bytes32 messageHash = keccak256(
      keccak256('address contract', 'address receiver', 'address token', 'address matic', 'bytes32 orderId', 'uint256 balance'),
      keccak256(address(this), receiver, token, matic, orderId, balance)
    );

    return messageHash;
  }

  /// @dev Returns the sender address extracted from the balance proof.
  /// @param receiver The address that receives tokens.
  /// @param token The token address for transaction signature.
  /// @param orderId The order id generated for unique transaction.
  /// @param balance The amount of tokens owed by the sender to the receiver.
  /// @param sig The balance message signed by the sender or receiver.
  /// @return Address of the balance proof signer.
  function verifyBalanceProof(address receiver, address token, bytes32 orderId, uint256 balance, bytes sig) public view returns (address) {
    // message hash derived from receiver, token, order id and balance
    bytes32 messageHash = getBalanceMessage(receiver, token, orderId, balance);

    // Derive address from signature
    return ECVerify.ecrecovery(messageHash, sig);
  }

  // @dev Returns token manager
  // @param token The token address for token manager
  function getTokenManager (address token) public view returns (uint32, uint256, uint256) {
    TokenManager memory manager = tokenManagers[token];

    // return token menager info
    return (manager.settleBlock, manager.deposit, manager.closingBalance);
  }

  /// @dev Deposits tokens into this channel (used by anyone)
  /// @param token The token address for deposit
  /// @param balance The amount value to be deposited
  function deposit(address token, uint256 balance) external {
    require(token != 0x0);
    require(addressHasCode(token));

    // get token instance
    StandardToken tokenObj = StandardToken(token);

    // transfer tokens from msg.sender to this contract
    require(tokenObj.transferFrom(msg.sender, address(this), balance));

    // deposit
    tokenManagers[token].deposit += balance;

    // log deposit
    Deposit(msg.sender, token, balance);
  }

  /// @dev Request settlement for given token and amount
  /// @param token The token address for settlement
  /// @param balance The amount value to be required for settlement
  function requestSettlement(address token, uint256 balance) onlyOwner external {
    // check for settle block
    require(tokenManagers[token].settleBlock == 0);
    // check for balance vs deposit
    require(balance <= tokenManagers[token].deposit);

    // set settlement block
    tokenManagers[token].settleBlock = uint32(block.number) + challengePeriod;

    // set closing balance
    tokenManagers[token].closingBalance = balance;

    // settlement requested
    SettlementRequested(msg.sender, token, balance, tokenManagers[token].settleBlock);
  }

  /// @dev Settle for given token and amount
  /// @param token The token address for settlement
  function settle(address token) onlyOwner external {
    require(tokenManagers[token].settleBlock != 0);
    require(block.number > tokenManagers[token].settleBlock);

    // get settlment closing balance
    uint256 amount = tokenManagers[token].closingBalance;

    // get token instance
    StandardToken tokenObj = StandardToken(token);

    // transfer balance to amount
    require(tokenObj.transfer(owner, amount));

    // close requested
    Settle(msg.sender, token, amount);
  }

  /// @dev Withdraw tokens using signature
  /// @param receiver The address of a receiver who owns signature
  /// @param token The token address for withdraw
  /// @param balance The total token amount for withdraw
  /// @param sig The signature which receiver receives from owner as part of payment
  /// @param maticSig The signature which receiver receives from matic network as part of payment validation
  function withdraw(address receiver, address token, uint256 balance, bytes sig, bytes maticSig) public {
    // check for receiver and token
    require(receiver != 0x0 && token != 0x0);

    bytes32 orderId = generateOrderId(receiver);
    bytes32 messageHash = getBalanceMessage(receiver, token, orderId, balance);
    address signer = ECVerify.ecrecovery(messageHash, sig);
    address maticSigner = ECVerify.ecrecovery(messageHash, maticSig);

    require(signer == owner);
    require(maticSigner == matic);
    require(signer != maticSigner); // matic address shouldn't be same as signer
    require(tokenManagers[token].deposit >= balance);

    // change order index for receiver
    orderIndexes[receiver] += 1;

    // change deposit balance
    tokenManagers[token].deposit -= balance;

    // get token instance
    StandardToken tokenObj = StandardToken(token);
    // make transfer
    require(tokenObj.transfer(receiver, balance));

    // Log event
    Withdraw(receiver, token, orderId, balance);
  }

  /// @notice Check if a contract exists
  /// @param _contract The address of the contract to check for.
  /// @return True if a contract exists, false otherwise
  function addressHasCode(address _contract) internal view returns (bool) {
    uint size;
    assembly {
      size := extcodesize(_contract)
    }

    return size > 0;
  }
}
