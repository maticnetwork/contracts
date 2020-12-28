pragma solidity 0.5.17;

contract ValidatorShareStorageExtension {
    struct DelegatorUnbond {
        uint256 shares;
        uint256 withdrawEpoch;
    }

    mapping(address => uint256) public unbondNonces;
    mapping(address => mapping(uint256 => DelegatorUnbond)) public unbonds_new;
}
