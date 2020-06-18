pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import { SignerList } from "../staking/stakeManager/SignerList.sol";

contract OrderedListTest is SignerList {
    function insert(uint160 signer) public {
        insertSigner(address(signer));
    }

    function update(uint160 prevSigner, uint160 signer) public {
        updateSigner(address(prevSigner), address(signer));
    }

    function remove(uint160 signer) public {
        removeSigner(address(signer));
    }

    function getTotalBuckets() public view returns(uint256) {
        return totalBuckets;
    }

    function getLastBucketId() public view returns(uint256) {
        return lastBucketId;
    }

    function getBucketIdByIndex(uint index) public view returns(uint256) {
        return bucketsByIndex[index];
    }

    function getBucketByIndex(uint index) public view returns(SignerList.Bucket memory) {
        return buckets[bucketsByIndex[index]];
    }

    function getBucketById(uint id) public view returns(SignerList.Bucket memory) {
        return buckets[id];
    }

    function getMaxBucketSize() public view returns(uint256) {
        return MAX_BUCKET_SIZE;
    }

    function findBucket(uint160 signer) public view returns(uint256, uint256, uint256) {
        (,uint256 bucketSize,uint256 bucketIndex) = _findSuitableBucket(address(signer));
        return (bucketSize, bucketIndex, bucketsByIndex[bucketIndex]);
    }
}
