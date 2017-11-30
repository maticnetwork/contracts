pragma solidity ^0.4.17;

import './token/StandardToken.sol';
import "./lib/ECVerify.sol";

contract MaticChannel {
  string constant prefix = "\x19Ethereum Signed Message:\n";

  // owner of this channel
  address public owner;
  // matic address
  address public matic;

  // challenge period
  uint8 public challengePeriod;

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
  event Deposit(address indexed sender, address indexed token, uint256 amount);
  event Withdraw(address indexed receiver, address indexed token, bytes32 indexed orderId, uint256 amount);
  event SettlementRequested(address indexed owner, address indexed token, uint256 amount, uint32 settleBlock);
  event Settle(address indexed owner, address indexed token, uint256 amount);

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
  function MaticChannel(address _owner, address _matic, uint8 _challengePeriod) public {
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
  /// @param amount The amount of tokens owed by the sender to the receiver.
  /// @return Hash of the balance message.
  function getBalanceMessage(address receiver, address token, bytes32 orderId, uint256 amount) public view returns (string) {
    string memory str = concat("Receiver: 0x", addressToString(receiver));
    str = concat(str, ", Token: 0x");
    str = concat(str, addressToString(token));
    str = concat(str, ", Matic: 0x");
    str = concat(str, addressToString(matic));
    str = concat(str, ", Order ID: ");
    str = concat(str, bytes32ToString(orderId));
    str = concat(str, ", Amount: ");
    str = concat(str, uintToString(uint256(amount)));
    return str;
  }

  /// @dev Returns hash for balance proof message.
  /// @param receiver The address that receives tokens.
  /// @param token The token address for transaction signature.
  /// @param orderId The order id generated for unique transaction.
  /// @param amount The amount of tokens owed by the sender to the receiver.
  /// @return proof message The bytes32 message calculated using order information.
  function getBalanceMessageHash(address receiver, address token, bytes32 orderId, uint256 amount) public view returns (bytes32) {
    // Create message which should be signed by sender
    string memory message = getBalanceMessage(receiver, token, orderId, amount);
    uint messageLength = bytes(message).length;
    string memory messageLengthStr = uintToString(messageLength);

    // Prefix the message
    string memory prefixedMessage = concat(prefix, messageLengthStr);
    prefixedMessage = concat(prefixedMessage, message);

    // Hash the prefixed message string
    return keccak256(prefixedMessage);
  }

  /// @dev Returns the sender address extracted from the balance proof.
  /// @param receiver The address that receives tokens.
  /// @param token The token address for transaction signature.
  /// @param orderId The order id generated for unique transaction.
  /// @param amount The amount of tokens owed by the sender to the receiver.
  /// @param sig The balance message signed by the sender or receiver.
  /// @return Address of the balance proof signer.
  function verifyBalanceProof(address receiver, address token, bytes32 orderId, uint256 amount, bytes sig) public view returns (address) {
    // Hash the prefixed message string
    bytes32 prefixedMessageHash = getBalanceMessageHash(receiver, token, orderId, amount);

    // Derive address from signature
    return verifyBalanceProofHash(prefixedMessageHash, sig);
  }

  /// @dev Returns the sender address extracted from the message hash.
  /// @param messageHash message hash from which address will be extracted.
  /// @param sig The balance message signed by the sender or receiver.
  /// @return Address of the balance proof signer.
  function verifyBalanceProofHash(bytes32 messageHash, bytes sig) public pure returns (address) {
    // Derive address from signature
    address signer = ECVerify.ecrecovery(messageHash, sig);
    return signer;
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
  /// @param amount The amount value to be deposited
  function deposit(address token, uint256 amount) external {
    require(token != 0x0);
    require(addressHasCode(token));

    // get token instance
    StandardToken tokenObj = StandardToken(token);

    // transfer tokens from msg.sender to this contract
    require(tokenObj.transferFrom(msg.sender, address(this), amount));

    // deposit
    tokenManagers[token].deposit += amount;

    // log deposit
    Deposit(msg.sender, token, amount);
  }

  /// @dev Request settlement for given token and amount
  /// @param token The token address for settlement
  /// @param amount The amount value to be required for settlement
  function requestSettlement(address token, uint256 amount) onlyOwner external {
    // check for settle block
    require(tokenManagers[token].settleBlock == 0);
    // check for amount vs deposit
    require(amount <= tokenManagers[token].deposit);

    // set settlement block
    tokenManagers[token].settleBlock = uint32(block.number) + challengePeriod;

    // set closing balance
    tokenManagers[token].closingBalance = amount;

    // settlement requested
    SettlementRequested(msg.sender, token, amount, tokenManagers[token].settleBlock);
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
  /// @param amount The total token amount for withdraw
  /// @param sig The signature which receiver receives from owner as part of payment
  /// @param maticSig The signature which receiver receives from matic network as part of payment validation
  function withdraw(address receiver, address token, uint256 amount, bytes sig, bytes maticSig) public {
    // check for receiver and token
    require(receiver != 0x0 && token != 0x0);

    bytes32 orderId = generateOrderId(receiver);
    bytes32 messageHash = getBalanceMessageHash(receiver, token, orderId, amount);
    address signer = verifyBalanceProofHash(messageHash, sig);
    address maticSigner = verifyBalanceProofHash(messageHash, maticSig);

    require(signer == owner);
    require(maticSigner == matic);
    require (tokenManagers[token].deposit >= amount);

    // change order index for receiver
    orderIndexes[receiver] += 1;

    // change deposit amount
    tokenManagers[token].deposit -= amount;

    // get token instance
    StandardToken tokenObj = StandardToken(token);
    // make transfer
    require(tokenObj.transfer(receiver, amount));

    // Log event
    Withdraw(receiver, token, orderId, amount);
  }

  //
  // Utility methods
  //

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

  function memcpy(uint dest, uint src, uint len) internal pure {
    for(; len >= 32; len -= 32) {
      assembly {
        mstore(dest, mload(src))
      }
      dest += 32;
      src += 32;
    }

    uint mask = 256 ** (32 - len) - 1;
    assembly {
      let srcpart := and(mload(src), not(mask))
      let destpart := and(mload(dest), mask)
      mstore(dest, or(destpart, srcpart))
    }
  }

  function concat(string _self, string _other) internal pure returns (string) {
    uint self_len = bytes(_self).length;
    uint other_len = bytes(_other).length;
    uint self_ptr;
    uint other_ptr;

    assembly {
        self_ptr := add(_self, 0x20)
        other_ptr := add(_other, 0x20)
    }

    var ret = new string(self_len + other_len);
    uint retptr;
    assembly { retptr := add(ret, 32) }
    memcpy(retptr, self_ptr, self_len);
    memcpy(retptr + self_len, other_ptr, other_len);
    return ret;
  }

  function uintToString(uint v) internal pure returns (string) {
    bytes32 ret;
    if (v == 0) {
      ret = '0';
    }
    else {
      while (v > 0) {
        ret = bytes32(uint(ret) / (2 ** 8));
        ret |= bytes32(((v % 10) + 48) * 2 ** (8 * 31));
        v /= 10;
      }
    }

    bytes memory bytesString = new bytes(32);
    uint charCount = 0;
    for (uint j=0; j<32; j++) {
      byte char = byte(bytes32(uint(ret) * 2 ** (8 * j)));
      if (char != 0) {
        bytesString[j] = char;
        charCount++;
      }
    }
    bytes memory bytesStringTrimmed = new bytes(charCount);
    for (j = 0; j < charCount; j++) {
      bytesStringTrimmed[j] = bytesString[j];
    }

    return string(bytesStringTrimmed);
  }

  function addressToString(address x) internal pure returns (string) {
    bytes memory str = new bytes(40);
    for (uint i = 0; i < 20; i++) {
      byte b = byte(uint8(uint(x) / (2**(8*(19 - i)))));
      byte hi = byte(uint8(b) / 16);
      byte lo = byte(uint8(b) - 16 * uint8(hi));
      str[2*i] = char(hi);
      str[2*i+1] = char(lo);
    }
    return string(str);
  }

  function char(byte b) internal pure returns (byte c) {
    if (b < 10) return byte(uint8(b) + 0x30);
    else return byte(uint8(b) + 0x57);
  }

  function bytes32ToString (bytes32 data) internal pure returns  (string) {
    bytes memory bytesString = new bytes(32);
    for (uint j = 0; j < 32; j++) {
      byte c = byte(bytes32(uint(data) * 2 ** (8 * j)));
      if (c != 0) {
        bytesString[j] = c;
      }
    }
    return string(bytesString);
  }
}
