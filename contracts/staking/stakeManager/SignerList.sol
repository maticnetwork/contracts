pragma solidity 0.5.17;

/**
    Simple list of addresses in ascending order.
*/

contract SignerList {
    address[] internal signers;

    function insertSigner(address newSigner) internal {
        signers.push(newSigner);

        uint i = signers.length - 1;
        for (; i > 0; --i) {
            address signer = signers[i - 1];
            if (signer < newSigner) {
                break;
            }
            signers[i] = signer;
        }

        signers[i] = newSigner;
    }

    function updateSigner(address prevSigner, address signerToDelete) internal {
        removeSigner(prevSigner);
        insertSigner(signerToDelete);
    }

    function removeSigner(address signerToDelete) internal {
        uint256 totalSigners = signers.length;
        address swapSigner = signers[totalSigners - 1];
        delete signers[totalSigners - 1];

        // bubble last element to the beginning until target signer is met
        for (uint i = totalSigners - 1; i > 0; --i) {
            if (swapSigner == signerToDelete) {
                break;
            }

            (swapSigner, signers[i - 1]) = (signers[i - 1], swapSigner);
        }

        signers.length = totalSigners - 1;
    }
}
