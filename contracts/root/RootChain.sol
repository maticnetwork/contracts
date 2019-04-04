pragma solidity ^0.5.5;

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { IRootChain } from './IRootChain.sol';
import { RootChainHeader, RootChainStorage } from './RootChainStorage.sol';
import { Registry } from './Registry.sol';

contract RootChain is RootChainStorage, IRootChain {
  using SafeMath for uint256;
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  modifier onlyDepositManager() {
    require(
      msg.sender == registry.getDepositManagerAddress(),
      "UNAUTHORIZED_DEPOSIT_MANAGER_ONLY"
    );
    _;
  }

  constructor (address _registry) public {
    registry = Registry(_registry);
  }

  function submitHeaderBlock(
    bytes calldata vote,
    bytes calldata sigs,
    bytes calldata extradata)
    external
  {
    require(
      _checkSignatures(vote, sigs),
      "INVALID_SIGS"
    );

    RootChainHeader.HeaderBlock memory headerBlock = _buildHeaderBlock(extradata);
    headerBlocks[_nextHeaderBlock] = headerBlock;
    emit NewHeaderBlock(msg.sender, _nextHeaderBlock, headerBlock.start, headerBlock.end, headerBlock.root);

    _nextHeaderBlock = _nextHeaderBlock.add(MAX_DEPOSITS);
    _depositCount = 0;
  }

  function createDepositBlock(address _owner, address _token, uint256 amountOrNFTId)
    external
    onlyDepositManager
  {
    require(
      _depositCount < MAX_DEPOSITS,
      "TOO_MANY_DEPOSITS"
    );
    uint256 depositId = _nextHeaderBlock.sub(MAX_DEPOSITS).add(_depositCount).add(1);
    deposits[depositId] = DepositBlock(_owner, _token, _nextHeaderBlock, amountOrNFTId, now);
    _depositCount.add(1);
  }

  function _checkSignatures(bytes memory vote, bytes memory sigs)
    private
    returns(bool)
  {
    return true;
  }

  function _buildHeaderBlock(bytes memory data)
    private
    returns(HeaderBlock memory headerBlock)
  {
    RLPReader.RLPItem[] memory dataList = data.toRlpItem().toList();

    // Is this required? Why does a proposer need to be the sender? Think validator relay networks
    // require(msg.sender == dataList[0].toAddress(), "Invalid proposer");

    uint256 nextChildBlock;
    /*
    The ID of the 1st header block is MAX_DEPOSITS.
    if _nextHeaderBlock == MAX_DEPOSITS, then the first header block is yet to be submitted, hence nextChildBlock = 0
    */
    if (_nextHeaderBlock > MAX_DEPOSITS) {
      nextChildBlock = headerBlocks[_nextHeaderBlock.sub(MAX_DEPOSITS)].end + 1;
    }
    require(
      nextChildBlock == dataList[1].toUint(),
      "INCORRECT_START_BLOCK"
    );
    headerBlock.start = nextChildBlock;
    headerBlock.end = dataList[2].toUint();
    require(
      headerBlock.end > headerBlock.start,
      "NOT_ADDING_BLOCKS"
    );

    // toUintStrict returns the encoded uint. Encoded data must be padded to 32 bytes.
    headerBlock.root = bytes32(dataList[3].toUintStrict());
    headerBlock.createdAt = now;
    headerBlock.proposer = msg.sender;
  }
}
