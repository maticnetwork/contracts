pragma solidity ^0.4.24;

import { ERC20 } from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import { ERC721 } from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import { WETH } from "../token/WETH.sol";
import { PriorityQueue } from "../lib/PriorityQueue.sol";
import { ExitNFT } from "../token/ExitNFT.sol";
import { RLP } from "../lib/RLP.sol";
import { RLPEncode } from "../lib/RLPEncode.sol";

import { WithdrawManager } from "./WithdrawManager.sol";
import { DepositManager } from "./DepositManager.sol";
import { IRootChain } from "./IRootChain.sol";
import { StakeManager } from "./StakeManager.sol";


contract RootChain is Ownable, IRootChain {
  using SafeMath for uint256;
  using RLP for bytes;
  using RLP for RLP.RLPItem;
  using RLP for RLP.Iterator;

  mapping(address => bool) public proofValidatorContracts;

  // child chain contract
  address public childChainContract;

  // list of header blocks (address => header block object)
  mapping(uint256 => HeaderBlock) public headerBlocks;

  // current header block number
  uint256 private _currentHeaderBlock;


  // stake interface
  StakeManager public stakeManager;
  
  // withdraw manager
  WithdrawManager public withdrawManager;

  // deposit manager
  DepositManager public depositManager;

  // only root chain
  modifier onlyWithdrawManager() {
    require(msg.sender == address(withdrawManager));
    _;
  }

  //
  // Constructor
  //

  constructor () public {
    // set current header block
    _currentHeaderBlock = CHILD_BLOCK_INTERVAL;
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
    depositEthers();
  }

  //
  // External functions
  //

  function submitHeaderBlock(bytes vote, bytes sigs, bytes extradata) external {
    RLP.RLPItem[] memory dataList = vote.toRLPItem().toList();
    require(keccak256(dataList[0].toData()) == chain, "Chain ID not same");
    require(keccak256(dataList[1].toData()) == roundType, "Round type not same ");
    require(dataList[4].toByte() == voteType, "Vote type not same");

    // validate extra data using getSha256(extradata)
    require(keccak256(dataList[5].toData()) == keccak256(bytes20(sha256(extradata))), "Extra data is invalid");

    // extract end and assign to current child
    dataList = extradata.toRLPItem().toList();

    // check proposer
    require(msg.sender == dataList[0].toAddress(), "Invalid proposer");
    uint256 start = currentChildBlock();
    if (start > 0) {
      start = start.add(1);
    }
    // Start on mainchain and matic chain must be same
    require(start == dataList[1].toUint(), "Start block doesn't match");
    uint256 end = dataList[2].toUint();
    bytes32 root = dataList[3].toBytes32();

    // Make sure we are adding blocks
    require(end > start, "Not adding blocks");

    // Make sure enough validators sign off on the proposed header root
    require(stakeManager.checkSignatures(keccak256(vote), sigs), "Sigs are invalid");

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

    // finalize commit
    depositManager.finalizeCommit(_currentHeaderBlock);
    withdrawManager.finalizeCommit(_currentHeaderBlock);
    stakeManager.finalizeCommit();

    // TODO add rewards
  }

  //
  // Public functions
  //

  // delete exit
  function deleteExit(uint256 exitId) public isProofValidator(msg.sender) {
    withdrawManager.deleteExit(exitId);
  }

  // set Exit NFT contract
  function setExitNFTContract(address _nftContract) public onlyOwner {
    // depositManager.setExitNFTContract(_nftContract);
    withdrawManager.setExitNFTContract(_nftContract);
  }

  // set WETH
  function setWETHToken(address _token) public onlyOwner {
    depositManager.setWETHToken(_token);
    withdrawManager.setWETHToken(_token);
  }

  // map child token to root token
  function mapToken(address _rootToken, address _childToken, bool _isERC721) public onlyOwner {
    depositManager.mapToken(_rootToken, _childToken, _isERC721);
    withdrawManager.mapToken(_rootToken, _childToken, _isERC721);
  }

  // change child chain contract
  function setChildContract(address newChildChain) public onlyOwner {
    require(newChildChain != address(0));
    emit ChildChainChanged(childChainContract, newChildChain);
    childChainContract = newChildChain;
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

  // Get deposit block
  function depositBlock(uint256 _depositCount) public view returns (
    uint256,
    address,
    address,
    uint256,
    uint256
  ) {
    return depositManager.depositBlock(_depositCount);
  }

  // set stake manager
  function setStakeManager(address _stakeManager) public onlyOwner {
    require(_stakeManager != address(0));
    stakeManager = StakeManager(_stakeManager);
  }

  // set deposit manager
  function setDepositManager(address _depositManager) public onlyOwner {
    require(_depositManager != address(0));
    depositManager = DepositManager(_depositManager);
  }

  // set withdraw manager
  function setWithdrawManager(address _withdrawManager) public onlyOwner {
    require(_withdrawManager != address(0));
    withdrawManager = WithdrawManager(_withdrawManager);
  }

  // deposit ethers
  function depositEthers() public payable {
    // retrieve ether amount
    uint256 _amount = msg.value;
    // get weth token
    address wethToken = depositManager.wethToken();

    // transfer ethers to this contract (through WETH)
    WETH t = WETH(wethToken);
    t.deposit.value(_amount)();

    // generate deposit block and udpate counter
    depositManager.createDepositBlock(_currentHeaderBlock, wethToken, msg.sender, _amount);
  }

  // deposit erc721
  function depositERC721(
    address _token,
    address _user,
    uint256 _tokenId) public {
    // transfer tokens to current contract
    ERC721(_token).transferFrom(msg.sender, address(this), _tokenId);

    // generate deposit block and udpate counter
    depositManager.createDepositBlock(_currentHeaderBlock, _token, _user, _tokenId);
  }

  // deposit tokens for another user
  function deposit(
    address _token,
    address _user,
    uint256 _amount
  ) public {
    // transfer tokens to current contract
    require(ERC20(_token).transferFrom(msg.sender, address(this), _amount));

    // generate deposit block and udpate counter
    depositManager.createDepositBlock(_currentHeaderBlock, _token, _user, _amount);
  }
  
  // transfer tokens to user
  function transferAmount(
    address _token,
    address _user,
    uint256 _amount
  ) public onlyWithdrawManager returns(bool)  { 

    address wethToken = depositManager.wethToken();

    // transfer to user TODO: use pull for transfer
    if (depositManager.isERC721(_token)) {
      ERC721(_token).transferFrom(address(this), _user, _amount);
    } else if (_token == wethToken) {
      WETH t = WETH(_token); 
      t.withdraw(_amount, _user);
    } else {
      require(ERC20(_token).transfer(_user, _amount));
    }
    return true;
  }
  
  /**
   * @dev Accept ERC223 compatible tokens
   * @param _user address The address that is transferring the tokens
   * @param _amount uint256 the amount of the specified token
   * @param _data Bytes The data passed from the caller.
   */
  function tokenFallback(address _user, uint256 _amount, bytes _data) public {
    address _token = msg.sender;

    // create deposit block with token fallback
    depositManager.createDepositBlock(_currentHeaderBlock, _token, _user, _amount);
  }

  // finalize commit
  function finalizeCommit(uint256) public {}

  // slash stakers if fraud is detected
  function slash() public isProofValidator(msg.sender) {
    // TODO pass block/proposer
  }
}
