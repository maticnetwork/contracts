pragma solidity ^0.5.2;

import {IERC721Receiver} from "openzeppelin-solidity/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {ContractReceiver} from "../../common/misc/ContractReceiver.sol";
import {Registry} from "../../common/Registry.sol";
import {WETH} from "../../common/tokens/WETH.sol";
import {IDepositManager} from "./IDepositManager.sol";
import {DepositManagerStorage} from "./DepositManagerStorage.sol";
import {StateSender} from "../stateSyncer/StateSender.sol";
import {GovernanceLockable} from "../../common/mixin/GovernanceLockable.sol";
import {RootChain} from "../RootChain.sol";


contract DepositManager is DepositManagerStorage, IDepositManager, IERC721Receiver, ContractReceiver {
    using SafeMath for uint256;

    modifier isTokenMapped(address _token) {
        require(registry.isTokenMapped(_token), "TOKEN_NOT_SUPPORTED");
        _;
    }

    modifier isPredicateAuthorized() {
        require(uint8(registry.predicates(msg.sender)) != 0, "Not a valid predicate");
        _;
    }

    constructor() public GovernanceLockable(address(0x0)) {}

    // deposit ETH by sending to this contract
    function() external payable {
        depositEther();
    }

    function updateMaxErc20Deposit(uint256 maxDepositAmount) public onlyGovernance {
        require(maxDepositAmount != 0);
        emit MaxErc20DepositUpdate(maxErc20Deposit, maxDepositAmount);
        maxErc20Deposit = maxDepositAmount;
    }

    function transferAssets(
        address _token,
        address _user,
        uint256 _amountOrNFTId
    ) external isPredicateAuthorized {
        address wethToken = registry.getWethTokenAddress();
        if (registry.isERC721(_token)) {
            IERC721(_token).transferFrom(address(this), _user, _amountOrNFTId);
        } else if (_token == wethToken) {
            WETH t = WETH(_token);
            t.withdraw(_amountOrNFTId, _user);
        } else {
            require(IERC20(_token).transfer(_user, _amountOrNFTId), "TRANSFER_FAILED");
        }
    }

    function depositERC20(address _token, uint256 _amount) external {
        depositERC20ForUser(_token, msg.sender, _amount);
    }

    function depositERC721(address _token, uint256 _tokenId) external {
        depositERC721ForUser(_token, msg.sender, _tokenId);
    }

    function depositBulk(
        address[] calldata _tokens,
        uint256[] calldata _amountOrTokens,
        address _user
    )
        external
        onlyWhenUnlocked // unlike other deposit functions, depositBulk doesn't invoke _safeCreateDepositBlock
    {
        require(_tokens.length == _amountOrTokens.length, "Invalid Input");
        uint256 depositId = rootChain.updateDepositId(_tokens.length);
        Registry _registry = registry;

        for (uint256 i = 0; i < _tokens.length; i++) {
            // will revert if token is not mapped
            if (_registry.isTokenMappedAndIsErc721(_tokens[i])) {
                IERC721(_tokens[i]).transferFrom(msg.sender, address(this), _amountOrTokens[i]);
            } else {
                require(
                    IERC20(_tokens[i]).transferFrom(msg.sender, address(this), _amountOrTokens[i]),
                    "TOKEN_TRANSFER_FAILED"
                );
            }
            _createDepositBlock(_user, _tokens[i], _amountOrTokens[i], depositId);
            depositId = depositId.add(1);
        }
    }

    /**
     * @dev Caches childChain and stateSender (frequently used variables) from registry
     */
    function updateChildChainAndStateSender() public {
        (address _childChain, address _stateSender) = registry.getChildChainAndStateSender();
        require(
            _stateSender != address(stateSender) || _childChain != childChain,
            "Atleast one of stateSender or childChain address should change"
        );
        childChain = _childChain;
        stateSender = StateSender(_stateSender);
    }

    function depositERC20ForUser(
        address _token,
        address _user,
        uint256 _amount
    ) public {
        require(_amount <= maxErc20Deposit, "exceed maximum deposit amount");
        require(IERC20(_token).transferFrom(msg.sender, address(this), _amount), "TOKEN_TRANSFER_FAILED");
        _safeCreateDepositBlock(_user, _token, _amount);
    }

    function depositERC721ForUser(
        address _token,
        address _user,
        uint256 _tokenId
    ) public {
        IERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
        _safeCreateDepositBlock(_user, _token, _tokenId);
    }

    // @todo: write depositEtherForUser
    function depositEther() public payable {
        address wethToken = registry.getWethTokenAddress();
        WETH t = WETH(wethToken);
        t.deposit.value(msg.value)();
        _safeCreateDepositBlock(msg.sender, wethToken, msg.value);
    }

    /**
   * @notice This will be invoked when safeTransferFrom is called on the token contract to deposit tokens to this contract
     without directly interacting with it
   * @dev msg.sender is the token contract
   * _operator The address which called `safeTransferFrom` function on the token contract
   * @param _user The address which previously owned the token
   * @param _tokenId The NFT identifier which is being transferred
   * _data Additional data with no specified format
   * @return `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
   */
    function onERC721Received(
        address, /* _operator */
        address _user,
        uint256 _tokenId,
        bytes memory /* _data */
    ) public returns (bytes4) {
        // the ERC721 contract address is the message sender
        _safeCreateDepositBlock(
            _user,
            msg.sender,
            /* token */
            _tokenId
        );
        return 0x150b7a02;
    }

    // See https://github.com/ethereum/EIPs/issues/223
    function tokenFallback(
        address _user,
        uint256 _amount,
        bytes memory /* _data */
    ) public {
        _safeCreateDepositBlock(
            _user,
            msg.sender,
            /* token */
            _amount
        );
    }

    function _safeCreateDepositBlock(
        address _user,
        address _token,
        uint256 _amountOrToken
    ) internal onlyWhenUnlocked isTokenMapped(_token) {
        _createDepositBlock(
            _user,
            _token,
            _amountOrToken,
            rootChain.updateDepositId(1) /* returns _depositId */
        );
    }

    function _createDepositBlock(
        address _user,
        address _token,
        uint256 _amountOrToken,
        uint256 _depositId
    ) internal {
        deposits[_depositId] = DepositBlock(keccak256(abi.encodePacked(_user, _token, _amountOrToken)), now);
        stateSender.syncState(childChain, abi.encode(_user, _token, _amountOrToken, _depositId));
        emit NewDepositBlock(_user, _token, _amountOrToken, _depositId);
    }

    // Housekeeping function. @todo remove later
    function updateRootChain(address _rootChain) public onlyOwner {
        rootChain = RootChain(_rootChain);
    }
}
