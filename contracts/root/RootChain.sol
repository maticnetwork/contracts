pragma solidity ^0.5.2;

import {RLPReader} from "solidity-rlp/contracts/RLPReader.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";

import {RootChainHeader, RootChainStorage} from "./RootChainStorage.sol";

import {IStakeManager} from "../staking/stakeManager/IStakeManager.sol";
import {IRootChain} from "./IRootChain.sol";
import {Registry} from "../common/Registry.sol";
import "../common/lib/BytesLib.sol";


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

    // function submitHeaderBlock(
    //     bytes calldata vote,
    //     bytes calldata sigs,
    //     bytes calldata txData
    // ) external {
    //     RLPReader.RLPItem[] memory dataList = vote.toRlpItem().toList();
    //     require(
    //         keccak256(dataList[0].toBytes()) == heimdallId,
    //         "Chain ID is invalid"
    //     );
    //     require(dataList[1].toUint() == VOTE_TYPE, "Vote type is invalid");

    //     // validate hash of txData was signed as part of the vote
    //     require(
    //         keccak256(dataList[4].toBytes()) ==
    //             keccak256(abi.encodePacked(sha256(txData))),
    //         "Extra data is invalid"
    //     );

    //     RLPReader.RLPItem[] memory extraData = txData.toRlpItem().toList();
    //     extraData = extraData[0].toList();
    //     RootChainHeader.HeaderBlock memory headerBlock = _buildHeaderBlock(
    //         extraData
    //     );
    //     headerBlocks[_nextHeaderBlock] = headerBlock;
    //     // check if it is better to keep it in local storage instead
    //     IStakeManager stakeManager = IStakeManager(
    //         registry.getStakeManagerAddress()
    //     );
    //     // blockInterval, voteHash, stateRoot, sigs
    //     uint256 _reward = stakeManager.checkSignatures(
    //         headerBlock.end.sub(headerBlock.start).add(1),
    //         keccak256(vote),
    //         bytes32(extraData[4].toUint()),
    //         sigs
    //     );
    //     require(_reward != 0, "Invalid checkpoint");
    //     emit NewHeaderBlock(
    //         headerBlock.proposer,
    //         _nextHeaderBlock,
    //         _reward,
    //         headerBlock.start,
    //         headerBlock.end,
    //         headerBlock.root
    //     );
    //     _nextHeaderBlock = _nextHeaderBlock.add(MAX_DEPOSITS);
    //     _blockDepositId = 1;
    // }

    // side channel
    function submitHeaderBlock(bytes calldata data, bytes calldata sigs)
        external
    {
        (
            address proposer,
            uint256 start,
            uint256 end,
            bytes32 rootHash,
            bytes32 accountHash,
            bytes32 _borChainID
        ) = abi.decode(
            data,
            (address, uint256, uint256, bytes32, bytes32, bytes32)
        );
        // require(bytes32(uint(15001)) == _borChainID, "Invalid bor chain id");

        require(
            _buildHeaderBlock(proposer, start, end, rootHash),
            "INCORRECT_HEADER_DATA"
        );

        // check if it is better to keep it in local storage instead
        IStakeManager stakeManager = IStakeManager(
            registry.getStakeManagerAddress()
        );

        // blockInterval, voteHash, stateRoot, sigs
        uint256 _reward = stakeManager.checkSignatures(
            end.sub(start).add(1),
            keccak256(abi.encodePacked(bytes(hex"01"), data)), // prefix 01 to data
            accountHash,
            sigs
        );
        require(_reward != 0, "Invalid checkpoint");
        emit NewHeaderBlock(
            proposer,
            _nextHeaderBlock,
            _reward,
            start,
            end,
            rootHash
        );
        _nextHeaderBlock = _nextHeaderBlock.add(MAX_DEPOSITS);
        _blockDepositId = 1;
    }

    function updateDepositId(uint256 numDeposits)
        external
        onlyDepositManager
        returns (uint256 depositId)
    {
        depositId = currentHeaderBlock().add(_blockDepositId);
        // deposit ids will be (_blockDepositId, _blockDepositId + 1, .... _blockDepositId + numDeposits - 1)
        _blockDepositId = _blockDepositId.add(numDeposits);
        require(
            // Since _blockDepositId is initialized to 1; only (MAX_DEPOSITS - 1) deposits per header block are allowed
            _blockDepositId <= MAX_DEPOSITS,
            "TOO_MANY_DEPOSITS"
        );
    }

    function getLastChildBlock() external view returns (uint256) {
        return headerBlocks[currentHeaderBlock()].end;
    }

    function slash() external {
        //TODO: future implementation
    }

    function currentHeaderBlock() public view returns (uint256) {
        return _nextHeaderBlock.sub(MAX_DEPOSITS);
    }

    function _buildHeaderBlock(
        address proposer,
        uint256 start,
        uint256 end,
        bytes32 rootHash
    ) private returns (bool) {
        HeaderBlock memory headerBlock;
        headerBlock.proposer = proposer;
        // Is this required? Why does a proposer need to be the sender? Think validator relay networks
        // require(msg.sender == dataList[0].toAddress(), "Invalid proposer");

        uint256 nextChildBlock;
        /*
    The ID of the 1st header block is MAX_DEPOSITS.
    if _nextHeaderBlock == MAX_DEPOSITS, then the first header block is yet to be submitted, hence nextChildBlock = 0
    */
        if (_nextHeaderBlock > MAX_DEPOSITS) {
            nextChildBlock = headerBlocks[currentHeaderBlock()].end + 1;
        }
        // require(nextChildBlock == start, "INCORRECT_START_BLOCK");
        if (nextChildBlock != start) {
            return false;
        }
        headerBlock.start = nextChildBlock;
        headerBlock.end = end;

        // toUintStrict returns the encoded uint. Encoded data must be padded to 32 bytes.
        headerBlock.root = rootHash;
        headerBlock.createdAt = now;
        headerBlocks[_nextHeaderBlock] = headerBlock;
        return true;
    }

    // Housekeeping function. @todo remove later
    function setNextHeaderBlock(uint256 _value) public onlyOwner {
        require(_value % MAX_DEPOSITS == 0, "Invalid value");
        for (uint256 i = _value; i < _nextHeaderBlock; i += MAX_DEPOSITS) {
            delete headerBlocks[i];
        }
        _nextHeaderBlock = _value;
        _blockDepositId = 1;
    }

    // Housekeeping function. @todo remove later
    function setHeimdallId(string memory _heimdallId) public onlyOwner {
        heimdallId = keccak256(abi.encodePacked(_heimdallId));
    }
}
