pragma solidity ^0.4.24;


import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { PriorityQueue } from "../lib/PriorityQueue.sol";
import { Merkle } from "../lib/Merkle.sol";
import { MerklePatriciaProof } from "../lib/MerklePatriciaProof.sol";
import { ExitNFT } from "../token/ExitNFT.sol";
import { RLP } from "../lib/RLP.sol";
import { RLPEncode } from "../lib/RLPEncode.sol";

import { WithdrawManager } from "./WithdrawManager.sol";
import { StakeManager } from "./StakeManager.sol";


contract RootChain is Ownable, WithdrawManager {
  using SafeMath for uint256;
  using Merkle for bytes32;

  // chain identifier
  bytes32 public constant chain = keccak256("test-chain-E5igIA");
  bytes32 public constant roundType = keccak256("vote");
  byte public constant voteType = 0x02;

  // stake interface
  StakeManager public stakeManager;
  mapping(address => bool) public proofValidatorContracts;

  // child chain contract
  address public childChainContract;

  // list of header blocks (address => header block object)
  mapping(uint256 => HeaderBlock) public headerBlocks;

  // current header block number
  uint256 private _currentHeaderBlock;

  //
  // Constructor
  //

  constructor (address _stakeManager) public {
    setStakeManager(_stakeManager);

    // set current header block
    _currentHeaderBlock = CHILD_BLOCK_INTERVAL;

    // reset deposit count
    depositCount = 1;
  }

  //
  // Events
  //

  event ChildChainChanged(address indexed previousChildChain, address indexed newChildChain);
  event ProofValidatorAdded(address indexed validator, address indexed from);
  event ProofValidatorRemoved(address indexed validator, address indexed from);
  event NewHeaderBlock(
    address indexed proposer,
    uint256 indexed number,
    uint256 start,
    uint256 end,
    bytes32 root
  );

  //
  // Modifiers
  //

  // Checks is msg.sender is valid validator
  modifier isProofValidator(address _address) {
    require(proofValidatorContracts[_address] == true);
    _;
  }

  //
  // Fallback
  //

  // deposit ETH by sending to this contract
  function () public payable {
    depositEthers(msg.sender);
  }

  //
  // External functions
  //


  //
  // Methods which will be called by validators
  //

  // delete exit
  function deleteExit(uint256 exitId) external isProofValidator (msg.sender) {
    ExitNFT exitNFT = ExitNFT(exitNFTContract);
    address owner = exitNFT.ownerOf(exitId);
    exitNFT.burn(owner, exitId);
  }

  // slash stakers if fraud is detected
  function slash() external isProofValidator(msg.sender) {
    // TODO pass block/proposer
  }

  //
  // Public functions
  //

  //
  // Admin functions
  //

  function networkId() public pure returns (bytes) {
    return "\x0d";
  }

  // change child chain contract
  function setChildContract(address newChildChain) public onlyOwner {
    require(newChildChain != address(0));
    emit ChildChainChanged(childChainContract, newChildChain);
    childChainContract = newChildChain;
  }

  // map child token to root token
  function mapToken(address _rootToken, address _childToken) public onlyOwner {
    // map root token to child token
    _mapToken(_rootToken, _childToken);

    // create exit queue
    exitsQueues[_rootToken] = address(new PriorityQueue());
  }

  // set WETH
  function setWETHToken(address _token) public onlyOwner {
    wethToken = _token;

    // weth token queue
    exitsQueues[wethToken] = address(new PriorityQueue());
  }

  // add validator
  function addProofValidator(address _validator) public onlyOwner {
    require(_validator != address(0) && proofValidatorContracts[_validator] != true);
    emit ProofValidatorAdded(_validator, msg.sender);
    proofValidatorContracts[_validator] = true;
  }

  // remove validator
  function removeProofValidator(address _validator) public onlyOwner {
    require(proofValidatorContracts[_validator] == true);
    emit ProofValidatorRemoved(_validator, msg.sender);
    delete proofValidatorContracts[_validator];
  }

  //
  // PoS functions
  //
  function setStakeManager(address _stakeManager) public onlyOwner {
    require(_stakeManager != address(0));
    stakeManager = StakeManager(_stakeManager);
  }

  function submitHeaderBlock(bytes vote, bytes sigs, bytes extradata) public {
    RLP.RLPItem[] memory dataList = vote.toRLPItem().toList();
    require(keccak256(dataList[0].toData()) == chain, "Chain ID not same");
    require(keccak256(dataList[1].toData()) == roundType, "Round type not same ");
    require(dataList[4].toByte() == voteType, "Vote type not same");

    // check proposer 
    require(msg.sender == dataList[5].toAddress());

    // validate extra data using getSha256(extradata) 
    require(keccak256(dataList[6].toData()) == keccak256(bytes20(sha256(extradata))));

    // extract end and assign to current child 
    dataList = extradata.toRLPItem().toList()[0].toList();
    uint256 start = currentChildBlock(); 
    uint256 end = dataList[2].toUint();
    bytes32 root = dataList[3].toBytes32();
    
    if (start > 0) {
      start = start.add(1);
    }

    // Start on mainchain and matic chain must be same
    require(start == dataList[1].toUint());

    // Make sure we are adding blocks
    require(end > start);

    // Make sure enough validators sign off on the proposed header root
    require(stakeManager.checkSignatures(keccak256(vote), sigs));

    // Add the header root
    HeaderBlock memory headerBlock = HeaderBlock({
      root: root,
      start: start,
      end: end,
      createdAt: block.timestamp,
      proposer: msg.sender
    });
    headerBlocks[_currentHeaderBlock] = headerBlock;

    // emit new header block
    emit NewHeaderBlock(
      msg.sender,
      _currentHeaderBlock,
      headerBlock.start,
      headerBlock.end,
      root
    );

    // update current header block
    _currentHeaderBlock = _currentHeaderBlock.add(CHILD_BLOCK_INTERVAL);

    // reset deposit count
    depositCount = 1;

    // TODO add rewards

    // finalize commit
    stakeManager.finalizeCommit();
  }

  //
  // Exit NFT
  //

  function setExitNFTContract(address _nftContract) public onlyOwner {
    require(_nftContract != address(0));
    exitNFTContract = _nftContract;
  }

  //
  // Header block
  //

  function currentChildBlock() public view returns(uint256) {
    if (_currentHeaderBlock != CHILD_BLOCK_INTERVAL) {
      return headerBlocks[_currentHeaderBlock.sub(CHILD_BLOCK_INTERVAL)].end;
    }

    return 0;
  }

  function currentHeaderBlock() public view returns (uint256) {
    return _currentHeaderBlock;
  }

  function headerBlock(uint256 _headerNumber) public view returns (
    bytes32 _root,
    uint256 _start,
    uint256 _end,
    uint256 _createdAt
  ) {
    HeaderBlock memory _headerBlock = headerBlocks[_headerNumber];

    _root = _headerBlock.root;
    _start = _headerBlock.start;
    _end = _headerBlock.end;
    _createdAt = _headerBlock.createdAt;
  }

  // deposit ethers
  function depositEthers() public payable {
    depositEthers(msg.sender);
  }

  //
  // Internal methods
  //

  function getHeaderBlock(
    uint256 headerNumber
  ) internal view returns (HeaderBlock _headerBlock) {
    _headerBlock = headerBlocks[headerNumber];
  }
}
