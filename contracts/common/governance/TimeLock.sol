pragma solidity 0.6.2;

import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Timelock {
    using SafeMath for uint256;

    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint256 indexed newDelay);
    event CancelTx(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event ExecuteTx(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event QueueTx(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    uint256 public constant GRACE_PERIOD = 14 days;
    uint256 public constant MINIMUM_DELAY = 2 days;
    uint256 public constant MAXIMUM_DELAY = 30 days;

    address public owner;
    address public pendingAdmin;
    uint256 public delay;

    mapping(bytes32 => bool) public queuedTxs;

    constructor(address _owner, uint256 _delay) public {
        require(_delay >= MINIMUM_DELAY, "Timelock::constructor: Delay must exceed minimum delay.");
        require(_delay <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");

        owner = _owner;
        delay = _delay;
    }

    function() external payable {}

    modifier onlySelf() {
      require(msg.sender == address(this), "Timelock: Call must come from Timelock.");
    }

    function setDelay(uint256 _delay) public onlySelf {
      _setDelay(_delay);
    }

    function acceptAdmin() public {
        require(msg.sender == pendingAdmin, "Timelock::acceptAdmin: Call must come from pendingAdmin.");
        owner = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(owner);
    }

    function setPendingAdmin(address _pendingAdmin) public onlySelf {
        pendingAdmin = _pendingAdmin;

        emit NewPendingAdmin(pendingAdmin);
    }

    function queueTx(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public returns (bytes32) {
        require(msg.sender == owner, "Timelock::queueTx: Call must come from owner.");
        require(
            eta >= getBlockTimestamp().add(delay),
            "Timelock::queueTx: Estimated execution block must satisfy delay."
        );

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTxs[txHash] = true;

        emit QueueTx(txHash, target, value, signature, data, eta);
        return txHash;
    }

    function cancelTx(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public {
        require(msg.sender == owner, "Timelock::queueTx: Call must come from owner.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTxs[txHash] = false;

        emit CancelTx(txHash, target, value, signature, data, eta);
    }

    function executeTx(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public payable returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTxs[txHash], "Timelock::executeTx: Transaction hasn't been queued.");
        require(getBlockTimestamp() >= eta, "Timelock::executeTx: Transaction hasn't surpassed time lock.");
        require(getBlockTimestamp() <= eta.add(GRACE_PERIOD), "Timelock::executeTx: Transaction is stale.");

        queuedTxs[txHash] = false;

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call.value(value)(callData);
        require(success, "Timelock::executeTx: Transaction execution reverted.");

        emit ExecuteTx(txHash, target, value, signature, data, eta);

        return returnData;
    }

    function _setDelay(uint256 _delay) internal {
        require(_delay >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
        require(_delay <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");
        delay = _delay;

        emit NewDelay(delay);
    }

    function getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}
