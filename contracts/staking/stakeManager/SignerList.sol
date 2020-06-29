pragma solidity ^0.5.2;

/**
    List of signers in ascending order.
    Uses buckets for optimized gas usage of reordering.
*/

contract SignerList {
    uint256 constant internal MAX_BUCKET_SIZE = 10;

    struct Bucket {
        address[MAX_BUCKET_SIZE] elements;
        uint256 size;
    }

    // index => bucket id
    mapping(uint256 => uint256) internal bucketsByIndex;
    // id => bucket
    mapping(uint256 => Bucket) internal buckets;

    uint256 internal totalBuckets;
    uint256 internal lastBucketId;

    function getBucket(uint256 index) internal view returns(Bucket storage) {
        return buckets[bucketsByIndex[index]];
    }

    function insertSigner(address signer) internal {
        (
            Bucket storage bucket, 
            uint256 bucketSize, 
            uint256 bucketIndex
        ) = _findSuitableBucket(signer);

        if (bucketSize == 0) {
            // bucket wasn't found, insert at bucketIndex position
            _insertIntoNewBucket(signer, bucketIndex);
        } else {
            _insertIntoBucket(signer, bucket, bucketSize, bucketIndex);
        }
    }

    function updateSigner(address oldSigner, address newSigner) internal {
        removeSigner(oldSigner);
        insertSigner(newSigner);
    }

    function removeSigner(address signerToDelete) internal {
        (
            Bucket storage bucket, 
            uint256 bucketSize, 
            uint256 bucketIndex
        ) = _findSuitableBucket(signerToDelete);

        require(bucketSize > 0, "not found");

        if (bucketSize == 1) {
            // delete bucket
            uint256 _totalBuckets = totalBuckets;
            uint256 bucketIdForSwap = bucketsByIndex[_totalBuckets - 1];
            bucketsByIndex[_totalBuckets - 1] = 0;
            
            for (uint i = totalBuckets - 1; i != bucketIndex; --i) {
                uint256 bucketId = bucketsByIndex[i - 1];
                bucketsByIndex[i - 1] = bucketIdForSwap;
                bucketIdForSwap = bucketId;
            }
            
            bucket.size = 0;
            bucket.elements[0] = address(0);
            totalBuckets--;
        } else {
            // delete from the bucket 
            // pop last element
            address swapSigner = bucket.elements[bucketSize - 1];
            bucket.elements[bucketSize - 1] = address(0);

            // bubble 0 to the beginning until target signer is met
            for (uint i = bucketSize - 1; i > 0; --i) {
                if (swapSigner == signerToDelete) {
                    break;
                }

                address signer = bucket.elements[i - 1];
                bucket.elements[i - 1] = swapSigner;
                swapSigner = signer;
            }

            bucket.size--;
        }
    }

    function _findSuitableBucket(address signer) 
    internal view 
    returns(
        Bucket storage,
        uint256,
        uint256
    ) {
        Bucket storage bucket = buckets[bucketsByIndex[0]];
        uint _totalBuckets = totalBuckets;
        uint bucketSize = bucket.size;

        if (_totalBuckets == 0) {
            return (bucket, bucketSize, 0);
        }

        uint low;
        uint high = _totalBuckets;
        uint nonFullBucketIndex = uint(-1);
        bool earlyExit;

        while (low < high) {
            uint middle = (low + high) / 2;

            bucket = buckets[bucketsByIndex[middle]];
            bucketSize = bucket.size;

            address firstElement = bucket.elements[0];
            address lastElement = bucket.elements[bucketSize - 1];
            if (firstElement <= signer && signer <= lastElement) {
                // signer fits within bucket range, early exit
                earlyExit = true;
                low = middle;
                break;
            }

            // if signer is on the left side of bucket range - shift search range on the left
            // otherwise shift it to the right
            if (firstElement > signer) {
                high = middle;
            } else {
                low = middle + 1;
            }

            // if current bucket is next to the one that is not full and it's 1st 
            // element is smaller than the one we are searching for
            // break out 
            if (middle > nonFullBucketIndex && middle - nonFullBucketIndex == 1) {
                break;
            }

            if (bucketSize < MAX_BUCKET_SIZE) {
                // bucket was not full, if next bucket contains all signers greater than 
                // we are searching for this bucket will be suitable for insertion
                nonFullBucketIndex = middle;
            }
        }

        // when bucket's range contains signer
        // bucket and bucketSize variables already pre-filled with correct values
        if (!earlyExit) {
            // if previous bucket that have 1st element smaller than the one 
            // we are searching for - select it that bucket as suitable
            if (
                (low > nonFullBucketIndex && low - nonFullBucketIndex == 1) ||
                (high < nonFullBucketIndex && nonFullBucketIndex - high == 1)
            ) {
                low = nonFullBucketIndex;
            }
            
            bucket = buckets[bucketsByIndex[low]];
            bucketSize = bucket.size;
            // if found bucket index is last bucket index
            // or if bucket is FULL and doesn't fit signer
            // reset bucketSize to indicate that bucket wasn't found
            if (low == _totalBuckets || (bucketSize == MAX_BUCKET_SIZE && bucket.elements[0] > signer)) {
                bucketSize = 0;
            }
        }
        
        return (bucket, bucketSize, low);
    }

    function _insertIntoBucket(address newSigner, Bucket storage targetBucket, uint256 bucketSize, uint256 bucketIndex) private {
        if (bucketSize == MAX_BUCKET_SIZE) {
            // bucket is full, move last element to the new bucket first
            Bucket storage nextBucket = buckets[bucketsByIndex[bucketIndex + 1]];
            uint nextBucketSize = nextBucket.size;
            if (bucketIndex + 1 == totalBuckets) {
                _insertIntoNewBucket(targetBucket.elements[bucketSize - 1], bucketIndex + 1);
            } else {
                _insertIntoBucket(targetBucket.elements[bucketSize - 1], nextBucket, nextBucketSize, bucketIndex + 1);
            }
            
            bucketSize--;
        }

        // move elements to the right until element that is lower than signer is met
        uint i = bucketSize;
        for (; i > 0; --i) {
            address signer = targetBucket.elements[i - 1];
            if (signer < newSigner) {
                break;
            }
            targetBucket.elements[i] = signer;
        }

        targetBucket.elements[i] = newSigner;
        targetBucket.size = bucketSize + 1;
    }

    function _insertIntoNewBucket(address signer, uint256 targetBucketIndex) private {
        for (uint i = totalBuckets; i > targetBucketIndex; --i) {
            bucketsByIndex[i] = bucketsByIndex[i - 1];
        }

        uint256 newBucketId = lastBucketId + 1;
        bucketsByIndex[targetBucketIndex] = newBucketId;

        Bucket memory newBucket;
        newBucket.elements[0] = signer;
        newBucket.size = 1;

        buckets[newBucketId] = newBucket;
        totalBuckets++;
        lastBucketId = newBucketId;
    }  
}
