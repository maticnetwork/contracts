pragma solidity ^0.5.2;

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { RLPReader } from "solidity-rlp/contracts/RLPReader.sol";

import { ValidatorVerifier } from "./ValidatorVerifier.sol";
import { IStateReceiver } from "./IStateReceiver.sol";


contract StateReceiver is ValidatorVerifier {
  using SafeMath for uint256;
  using RLPReader for bytes;
  using RLPReader for RLPReader.RLPItem;

  // states
  mapping(uint256 => bool) public states;

  // event for new state
  event NewStateSynced(uint256 indexed id, address indexed contractAddress, bytes data);

  // commit new state
  function commitState(
    bytes calldata vote,
    bytes calldata sigs,
    bytes calldata txBytes,
    bytes calldata proof
  ) external {
    // validator validator set
    validateValidatorSet(vote, sigs, txBytes, proof);

    // check transaction data
    RLPReader.RLPItem[] memory dataList = txBytes.toRlpItem().toList();

    // dataList = [msg, signature, memo]
    // msg = dataList[0]
    dataList = dataList[0].toList();

    // address proposer = dataList[0].toAddress();
    // bytes32 txHash = dataList[1].toBytes32();
    // uint256 logIndex = dataList[2].toUint();
    uint256 stateId = dataList[3].toUint();
    address contractAddress = dataList[4].toAddress();
    bytes memory stateData = dataList[5].toBytes();

    // state id must be same as state counter
    require(states[stateId] == false, "Invalid state id");

    // notify state receiver contract
    if (isContract(contractAddress)) {
      IStateReceiver(contractAddress).onStateReceive(stateId, stateData);
    }

    // set state
    states[stateId] = true;

    // emit event
    emit NewStateSynced(stateId, contractAddress, stateData);
  }

  // check if address is contract
  function isContract(address _addr) private view returns (bool){
    uint32 size;
    assembly {
      size := extcodesize(_addr)
    }
    return (size > 0);
  }
}
