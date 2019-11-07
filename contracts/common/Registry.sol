pragma solidity ^0.5.2;

import { Ownable } from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import { IWithdrawManager } from "../root/withdrawManager/IWithdrawManager.sol";

contract Registry is Ownable {
  // @todo hardcode constants
  bytes32 constant private WETH_TOKEN = keccak256("wethToken");
  bytes32 constant private DEPOSIT_MANAGER = keccak256("depositManager");
  bytes32 constant private STAKE_MANAGER = keccak256("stakeManager");
  bytes32 constant private DELEGATION_MANAGER = keccak256("delegationManager");
  bytes32 constant private WITHDRAW_MANAGER = keccak256("withdrawManager");
  bytes32 constant private CHILD_CHAIN = keccak256("childChain");
  bytes32 constant private STATE_SENDER = keccak256("stateSender");
  bytes32 constant private SLASHING_MANAGER = keccak256("slashingManager");

  address public erc20Predicate;
  address public erc721Predicate;

  mapping(bytes32 => address) contractMap;
  mapping(address => address) public rootToChildToken;
  mapping(address => address) public childToRootToken;
  // @todo we can think of one function from the registry which returns both (childToken,isERC721) if we are using it frequently together.
  mapping(address => bool) public proofValidatorContracts;
  mapping(address => bool) public isERC721;

  enum Type { Invalid, ERC20, ERC721, Custom }
  struct Predicate {
    Type _type;
  }
  mapping(address => Predicate) public predicates;

  event TokenMapped(address indexed rootToken, address indexed childToken);
  event ProofValidatorAdded(address indexed validator, address indexed from);
  event ProofValidatorRemoved(address indexed validator, address indexed from);
  event PredicateAdded(address indexed predicate, address indexed from);
  event PredicateRemoved(address indexed predicate, address indexed from);
  event ContractMapUpdated(
   bytes32 indexed key,
   address indexed previousContract,
   address indexed newContract
  );

  function updateContractMap(bytes32 _key, address _address)
    external
    onlyOwner
  {
    emit ContractMapUpdated(_key, contractMap[_key], _address);
    contractMap[_key] = _address;
  }

  /**
   * @dev Map root token to child token
   * @param _rootToken Token address on the root chain
   * @param _childToken Token address on the child chain
   * @param _isERC721 Is the token being mapped ERC721
   */
  function mapToken(address _rootToken, address _childToken, bool _isERC721)
    external
    onlyOwner
  {
    require(
      _rootToken != address(0x0) && _childToken != address(0x0),
      "INVALID_TOKEN_ADDRESS"
    );
    rootToChildToken[_rootToken] = _childToken;
    childToRootToken[_childToken] = _rootToken;
    isERC721[_rootToken] = _isERC721;
    IWithdrawManager(contractMap[WITHDRAW_MANAGER]).createExitQueue(_rootToken);
    emit TokenMapped(_rootToken, _childToken);
  }

  function addProofValidator(address _validator) public onlyOwner {
    require(_validator != address(0) && proofValidatorContracts[_validator] != true);
    emit ProofValidatorAdded(_validator, msg.sender);
    proofValidatorContracts[_validator] = true;
  }

  function addErc20Predicate(address predicate) public onlyOwner {
    erc20Predicate = predicate;
    addPredicate(predicate, Type.ERC20);
  }

  function addErc721Predicate(address predicate) public onlyOwner {
    erc721Predicate = predicate;
    addPredicate(predicate, Type.ERC721);
  }

  function addPredicate(address predicate, Type _type) public onlyOwner
  {
    require(predicates[predicate]._type == Type.Invalid, "Predicate already added");
    predicates[predicate]._type = _type;
    emit PredicateAdded(predicate, msg.sender);
  }

  function removePredicate(address predicate) public onlyOwner
  {
    delete predicates[predicate];
    emit PredicateRemoved(predicate, msg.sender);
  }

  function removeProofValidator(address _validator) public onlyOwner {
    require(proofValidatorContracts[_validator] == true);
    emit ProofValidatorRemoved(_validator, msg.sender);
    delete proofValidatorContracts[_validator];
  }

  function getDelegationManagerAddress() public view returns(address) {
    return contractMap[DELEGATION_MANAGER];
  }

  function getWethTokenAddress() public view returns(address) {
    return contractMap[WETH_TOKEN];
  }

  function getDepositManagerAddress() public view returns(address) {
    return contractMap[DEPOSIT_MANAGER];
  }

  function getStakeManagerAddress() public view returns(address) {
    return contractMap[STAKE_MANAGER];
  }

  function getSlashingManagerAddress() public view returns(address) {
    return contractMap[SLASHING_MANAGER];
  }

  function getWithdrawManagerAddress() public view returns(address) {
    return contractMap[WITHDRAW_MANAGER];
  }

  function getChildChainAndStateSender() public view returns(address, address) {
    return (contractMap[CHILD_CHAIN], contractMap[STATE_SENDER]);
  }

  function isTokenMapped(address _token) public view returns (bool) {
    return rootToChildToken[_token] != address(0x0);
  }

  function isTokenMappedAndIsErc721(address _token) public view returns (bool) {
    require(isTokenMapped(_token), "TOKEN_NOT_MAPPED");
    return isERC721[_token];
  }

  function isTokenMappedAndGetPredicate(address _token) public view returns (address) {
    if (isTokenMappedAndIsErc721(_token)) {
      return erc721Predicate;
    }
    return erc20Predicate;
  }

  function isChildTokenErc721(address childToken) public view returns(bool) {
    address rootToken = childToRootToken[childToken];
    require(rootToken != address(0x0), "Child token is not mapped");
    return isERC721[rootToken];
  }
}
