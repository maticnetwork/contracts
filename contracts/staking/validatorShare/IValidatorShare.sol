pragma solidity ^0.5.2;

import {ERC20} from "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {
    ERC721Full
} from "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import {Lockable} from "../../common/mixin/Lockable.sol";
import {StakingInfo} from "../StakingInfo.sol";
import {IStakeManager} from "../stakeManager/IStakeManager.sol";


contract IValidatorShare is ERC20, Lockable, Ownable {
    using SafeMath for uint256;
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

    constructor(
        uint256 _validatorId,
        address _stakingLogger,
        address _stakeManager
    ) public Lockable(_stakeManager) {
        validatorId = _validatorId;
        stakingLogger = StakingInfo(_stakingLogger);
        stakeManager = IStakeManager(_stakeManager);
        _transferOwnership(_stakeManager);
    }

    function updateRewards(uint256 _reward, uint256 _totalStake)
        external
        returns (uint256);

    function updateCommissionRate(uint256 newCommissionRate) external;

    function withdrawRewardsValidator() external returns (uint256);

    function addProposerBonus(uint256 _rewards, uint256 valStake) public;

    function exchangeRate() public view returns (uint256);

    function buyVoucher(uint256 _amount) public;

    function sellVoucher() public;

    function withdrawRewards() public;

    function unStakeClaimTokens() public;

    function slash(uint256 valPow, uint256 totalAmountToSlash)
        external
        returns (uint256);
}
