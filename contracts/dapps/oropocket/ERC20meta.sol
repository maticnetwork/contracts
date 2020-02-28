pragma solidity ^0.5.2;

import {ChildERC20} from "../../child/ChildERC20.sol";

contract ERC20Meta is ChildERC20 {
    mapping(address => uint256) public replayNonce;

    event LogTransfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 input1,
        uint256 input2
    );

    function transferFrom(address from, address to, uint256 value)
        public
        returns (bool)
    {
        uint256 input1 = this.balanceOf(from);
        uint256 input2 = this.balanceOf(to);
        _transfer(from, to, value);
        emit LogTransfer(from, to, value, input1, input2);
        return true;
    }

    function metaTransfer(
        bytes calldata signature,
        address to,
        uint256 value,
        uint256 nonce
    ) external returns (bool) {
        bytes32 metaHash = metaTransferHash(to, value, nonce);
        address signer = _getSigner(metaHash, signature);

        require(signer != address(0), "metaTransfer: invalid signer address");
        require(nonce == replayNonce[signer], "metaTransfer: invalid nonce");

        replayNonce[signer]++;
        _transfer(signer, to, value);
    }

    function metaTransferHash(address to, uint256 value, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    address(this),
                    "metaTransfer",
                    to,
                    value,
                    nonce
                )
            );
    }

    function getUserReplayNonce(address user) public view returns (uint256) {
        return replayNonce[user];
    }

    function _getSigner(bytes32 _hash, bytes memory _signature)
        internal
        pure
        returns (address)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;

        if (_signature.length != 65) {
            return address(0);
        }

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            return address(0);
        } else {
            return
                ecrecover(
                    keccak256(
                        abi.encodePacked(
                            "\x19Ethereum Signed Message:\n32",
                            _hash
                        )
                    ),
                    v,
                    r,
                    s
                );
        }
    }
}
