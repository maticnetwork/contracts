pragma solidity ^0.5.2;

import {ERC721} from "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";
import {Registry} from "../../common/Registry.sol";

contract ExitNFT is ERC721 {
    Registry internal registry;

    modifier onlyWithdrawManager() {
        require(
            msg.sender == registry.getWithdrawManagerAddress(),
            "UNAUTHORIZED_WITHDRAW_MANAGER_ONLY"
        );
        _;
    }

    constructor(address _registry) public {
        registry = Registry(_registry);
    }

    function mint(address _owner, uint256 _tokenId)
        external
        onlyWithdrawManager
    {
        _mint(_owner, _tokenId);
    }

    function burn(uint256 _tokenId) external onlyWithdrawManager {
        _burn(_tokenId);
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }
}
