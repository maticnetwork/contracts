pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract MaticToken is ERC20Pausable, ERC20Detailed {
    constructor(
        string memory name,
        string memory symbol
    ) public ERC20Detailed(name, symbol, 18) {

        uint256 totalSupply = 10**10 * (10**18);

        _mint(msg.sender, totalSupply);
    }
}
