pragma solidity 0.4.18;

import "./lib/ECVerify.sol";
import "./mixin/Ownable.sol";
import "./MaticChannel.sol";

contract MaticProtocol is Ownable {
  uint8 constant public version = 1;

  // Fee
  uint256 public fee;

  // contract maps
  mapping(address => bool) public contractMap;

  // user -> contracts mapping
  mapping(address => address[]) public userContracts;

  // Events

  // fees related events
  event FeeChanged(uint256 newFee);
  event FeeWithdraw(uint256 amount);

  // Event contract created
  event MaticChannelCreated(address _sender, address _address);


  //
  // Modifiers
  //

  // Only if amount value is greater than/equals to decided fee
  modifier enoughPaid() {
    require(msg.value >= fee);
    _;
  }

  // Constructor
  function MaticProtocol() public {

  }

  /// @dev Returns number of contracts by creator.
  /// @param creator Contract creator.
  /// @return Returns number of contracts by creator.
  function getContractCount(address creator) public constant returns (uint) {
    return userContracts[creator].length;
  }

  /// @dev Set fee for contract creation
  /// @param _fee for contract creation
  function updateFee(uint256 _fee) public onlyOwner {
    fee = _fee;
    FeeChanged(fee);
  }

  /// @dev Withdraw collected fees
  function withdrawFee() public onlyOwner {
    uint256 balance = this.balance;
    owner.transfer(this.balance);
    FeeWithdraw(balance);
  }

  /// @dev Registers contract in factory registry.
  /// @param _creator Creator's address of channel.
  /// @param _challengePeriod Challege period for settlement.
  /// @return Returns address of created contract.
  function createMaticChannel(address _creator, uint8 _challengePeriod) public payable enoughPaid returns (address) {
    MaticChannel channel = new MaticChannel(_creator, address(this), _challengePeriod);

    // register created channel
    contractMap[channel] = true;
    userContracts[msg.sender].push(channel);
    MaticChannelCreated(msg.sender, channel);
  }
}
