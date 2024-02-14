// SPDX-License-Identifier: MIT
pragma solidity ^0.5.2;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

// this impl was shortened for testing purposes
// full impl at https://github.com/0xPolygon/indicia/blob/main/src/PolygonMigration.sol
contract PolygonMigrationTest {
    using SafeERC20 for IERC20;

    event Migrated(address indexed account, uint256 amount);

    IERC20 public polygon;
    IERC20 public matic;

    function setTokenAddresses(address matic_, address polygon_) external {
        if (matic_ == address(0)) revert();
        matic = IERC20(matic_);

        if (polygon_ == address(0)) revert();
        polygon = IERC20(polygon_);
    }

    /// @notice This function allows for migrating MATIC tokens to POL tokens
    /// @dev The function does not do any validation since the migration is a one-way process
    /// @param amount Amount of MATIC to migrate
    function migrate(uint256 amount) external {
        emit Migrated(msg.sender, amount);

        matic.safeTransferFrom(msg.sender, address(this), amount);
        polygon.safeTransfer(msg.sender, amount);
    }
}
