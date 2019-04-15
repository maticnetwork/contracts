pragma solidity ^0.5.2;

import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";
import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { IRootChain } from './IRootChain.sol';
import { RootChainHeader, RootChainStorage } from './RootChainStorage.sol';
import { IStakeManager } from './stakeManager/IStakeManager.sol';
import { Registry } from '../common/Registry.sol';

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
    RLPReader.RLPItem[] memory dataList = vote.toRlpItem().toList();
    require(keccak256(dataList[0].toBytes()) == CHAIN, "Chain ID not same");
    require(keccak256(dataList[1].toBytes()) == ROUND_TYPE, "Round type not same ");
    require(dataList[4].toUint() == VOTE_TYPE, "Vote type not same");

    // validate hash of extradata was signed as part of the vote
    require(keccak256(dataList[5].toBytes()) == keccak256(abi.encodePacked(bytes20(sha256(extradata)))), "Extra data is invalid");

    // check if it is better to keep it in local storage instead
    IStakeManager stakeManager = IStakeManager(registry.getStakeManagerAddress());
    stakeManager.checkSignatures(keccak256(vote), sigs);

    RootChainHeader.HeaderBlock memory headerBlock = _buildHeaderBlock(extradata);
    headerBlocks[_nextHeaderBlock] = headerBlock;

    emit NewHeaderBlock(msg.sender, _nextHeaderBlock, headerBlock.start, headerBlock.end, headerBlock.root);
    _nextHeaderBlock = _nextHeaderBlock.add(MAX_DEPOSITS);
    _blockDepositId = 1;
  }

  function createDepositBlock(address _owner, address _token, uint256 _amountOrNFTId)
    external
    onlyDepositManager
  {
    require(
      // Only MAX_DEPOSITS per header block are allowed
      _blockDepositId < MAX_DEPOSITS,
      "TOO_MANY_DEPOSITS"
    );
    uint256 depositId = _nextHeaderBlock.sub(MAX_DEPOSITS).add(_blockDepositId);
    deposits[depositId] = DepositBlock(_owner, _token, _nextHeaderBlock, _amountOrNFTId, now);

    emit NewDepositBlock(_owner, _token, _amountOrNFTId, depositId);
    _blockDepositId.add(1);
  }

  function _buildHeaderBlock(bytes memory data)
    private
    view
    returns(HeaderBlock memory headerBlock)
  {
    RLPReader.RLPItem[] memory dataList = data.toRlpItem().toList();

    // Is this required? Why does a proposer need to be the sender? Think validator relay networks
    // require(msg.sender == dataList[0].toAddress(), "Invalid proposer");
    headerBlock.proposer = dataList[0].toAddress();

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
      headerBlock.end >= headerBlock.start,
      "NOT_ADDING_BLOCKS"
    );

    // toUintStrict returns the encoded uint. Encoded data must be padded to 32 bytes.
    headerBlock.root = bytes32(dataList[3].toUintStrict());
    headerBlock.createdAt = now;
    headerBlock.proposer = msg.sender;
  }
}
