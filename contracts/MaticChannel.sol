pragma solidity ^0.4.17;

import './token/StandardToken.sol';
import "./lib/ECVerify.sol";

contract MaticChannel {
  string constant prefix = "\x19Ethereum Signed Message:\n";

  address public owner;
  address public matic;
  uint8 public challengePeriod;

  // challenge period flag
  bool public challengePeriodStarted = false;

  // order index for receiver
  mapping (address => uint256) public orderIndexes;
  // token deposites
  mapping (address => uint256) public tokenDeposites;

  // Events
  event Deposit(address indexed sender, address indexed token, uint256 amount);
  event Withdraw(address indexed receiver, address indexed token, bytes32 indexed orderId, uint256 amount);
  event CloseChannelRequested(address indexed sender, uint256 amount);

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

  /// @dev Returns the sender address extracted from the balance proof.
  /// @param receiver The address that receives tokens.
  /// @param token The token address for transaction signature.
  /// @param orderId The order id generated for unique transaction.
  /// @param amount The amount of tokens owed by the sender to the receiver.
  /// @param sig The balance message signed by the sender or receiver.
  /// @return Address of the balance proof signer.
  function verifyBalanceProof(address receiver, address token, bytes32 orderId, uint256 amount, bytes sig) public view returns (address) {
    // Create message which should be signed by sender
    string memory message = getBalanceMessage(receiver, token, orderId, amount);
    uint messageLength = bytes(message).length;
    string memory messageLengthStr = uintToString(messageLength);

    // Prefix the message
    string memory prefixedMessage = concat(prefix, messageLengthStr);
    prefixedMessage = concat(prefixedMessage, message);

    // Hash the prefixed message string
    bytes32 prefixedMessageHash = keccak256(prefixedMessage);

    // Derive address from signature
    address signer = ECVerify.ecrecovery(prefixedMessageHash, sig);
    return signer;
  }

  function deposit(address token, uint256 value) external {
    require(token != 0x0);
    require(addressHasCode(token));

    // get token instance
    StandardToken tokenObj = StandardToken(token);

    // transfer tokens from msg.sender to this contract
    require(tokenObj.transferFrom(msg.sender, address(this), value));

    // deposit
    tokenDeposites[token] += value;

    // event for deposit
    Deposit(msg.sender, token, value);
  }

  function close(uint256 balance) onlyOwner external {
    require(challengePeriodStarted == false);
    challengePeriodStarted = true;

    // close requested
    CloseChannelRequested(msg.sender, balance);
  }

  function withdraw(address receiver, address token, uint256 amount, bytes sig, bytes maticSig) public {
    bytes32 orderId = generateOrderId(receiver);
    var signer = verifyBalanceProof(receiver, token, orderId, amount, sig);
    var maticSigner = verifyBalanceProof(receiver, token, orderId, amount, maticSig);

    require(signer == owner);
    require(maticSigner == matic);
    require (tokenDeposites[token] >= amount);

    // get token instance
    StandardToken tokenObj = StandardToken(token);
    // make transfer
    require(tokenObj.transfer(receiver, amount));
    // change deposit amount
    tokenDeposites[token] -= amount;

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
