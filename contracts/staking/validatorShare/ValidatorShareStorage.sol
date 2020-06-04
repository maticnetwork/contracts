pragma solidity ^0.5.2;

import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import {Lockable} from "../../common/mixin/Lockable.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {IStakeManager} from "../stakeManager/IStakeManager.sol";
import {ProxyStorage} from "../../common/misc/ProxyStorage.sol";


contract ValidatorShareHeader {
    struct Delegator {
        uint256 shares;
        uint256 withdrawEpoch;
    }
}


contract ERC20Disabled is ERC20 {
    function _transfer(
        address from,
        address to,
        uint256 value
    ) internal {
        revert("Disabled");
    }
}


contract ValidatorShareStorage is ProxyStorage, ERC20Disabled, Lockable, ValidatorShareHeader {
    uint256 constant EXCHANGE_RATE_PRECISION = 100;
    uint256 constant MAX_COMMISION_RATE = 100;
    uint256 constant REWARD_PRECISION = 10000;

    StakingInfo public stakingLogger;
    IStakeManager public stakeManager;
    uint256 public validatorId;
    uint256 public validatorRewards;
    uint256 public commissionRate;
    //last checkpoint where validator updated commission rate
    uint256 public lastCommissionUpdate;
    uint256 public minAmount = 10**18;

    uint256 public totalStake;
    uint256 public rewardPerShare;
    uint256 public activeAmount;
    bool public delegation = true;

    uint256 public withdrawPool;
    uint256 public withdrawShares;

    mapping(address => uint256) public amountStaked;
    mapping(address => Delegator) public delegators;
    mapping(address => uint256) public initalRewardPerShare;
}
