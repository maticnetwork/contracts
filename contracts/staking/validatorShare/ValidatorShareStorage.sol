pragma solidity ^0.5.2;

import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import {Lockable} from "../../common/mixin/Lockable.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {IStakeManager} from "../stakeManager/IStakeManager.sol";
import {ProxyStorage} from "../../common/misc/ProxyStorage.sol";

contract ValidatorShareStorage is ProxyStorage, ERC20, Lockable {
    StakingInfo public stakingLogger;
    IStakeManager public stakeManager;
    uint256 public validatorId;
    uint256 public validatorRewards;
    uint256 public commissionRate;
    //last checkpoint where validator updated commission rate
    uint256 public lastCommissionUpdate;
    uint256 public validatorDelegatorRatio = 10;
    uint256 public minAmount = 10**18;

    uint256 public totalStake;
    uint256 public rewards;
    uint256 public activeAmount;
    bool public delegation = true;

    uint256 public withdrawPool;
    uint256 public withdrawShares;

    struct Delegator {
        uint256 share;
        uint256 withdrawEpoch;
    }
    mapping(address => uint256) public amountStaked;
    mapping(address => Delegator) public delegators;
}
