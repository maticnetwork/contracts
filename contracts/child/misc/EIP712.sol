pragma solidity ^0.5.2;

import {ChainIdMixin} from "../../common/mixin/ChainIdMixin.sol";

contract LibEIP712Domain is ChainIdMixin {
    string internal constant EIP712_DOMAIN_SCHEMA = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
    bytes32 public constant EIP712_DOMAIN_SCHEMA_HASH = keccak256(
        abi.encodePacked(EIP712_DOMAIN_SCHEMA)
    );

    string internal constant EIP712_DOMAIN_NAME = "Matic Network";
    string internal constant EIP712_DOMAIN_VERSION = "1";
    uint256 internal constant EIP712_DOMAIN_CHAINID = CHAINID;

    bytes32 public EIP712_DOMAIN_HASH;

    constructor() public {
        EIP712_DOMAIN_HASH = keccak256(
            abi.encode(
                EIP712_DOMAIN_SCHEMA_HASH,
                keccak256(bytes(EIP712_DOMAIN_NAME)),
                keccak256(bytes(EIP712_DOMAIN_VERSION)),
                EIP712_DOMAIN_CHAINID,
                address(this)
            )
        );
    }

    function hashEIP712Message(bytes32 hashStruct)
        internal
        view
        returns (bytes32 result)
    {
        return _hashEIP712Message(hashStruct, EIP712_DOMAIN_HASH);
    }

    function hashEIP712MessageWithAddress(bytes32 hashStruct, address add)
        internal
        view
        returns (bytes32 result)
    {
        bytes32 domainHash = keccak256(
            abi.encode(
                EIP712_DOMAIN_SCHEMA_HASH,
                keccak256(bytes(EIP712_DOMAIN_NAME)),
                keccak256(bytes(EIP712_DOMAIN_VERSION)),
                EIP712_DOMAIN_CHAINID,
                add
            )
        );
        return _hashEIP712Message(hashStruct, domainHash);
    }

    function _hashEIP712Message(bytes32 hashStruct, bytes32 domainHash)
        internal
        pure
        returns (bytes32 result)
    {
        assembly {
            // Load free memory pointer
            let memPtr := mload(64)

            mstore(
                memPtr,
                0x1901000000000000000000000000000000000000000000000000000000000000
            ) // EIP191 header
            mstore(add(memPtr, 2), domainHash) // EIP712 domain hash
            mstore(add(memPtr, 34), hashStruct) // Hash of struct

            // Compute hash
            result := keccak256(memPtr, 66)
        }
    }
}
