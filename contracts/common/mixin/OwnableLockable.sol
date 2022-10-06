//SPDX-License-Identifier:MIT
pragma solidity ^0.8.17;
import { Lockable } from "./Lockable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract OwnableLockable is Lockable, Ownable {
    function lock() public onlyOwner {
        super.lock();
    }

    function unlock() public onlyOwner {
        super.unlock();
    }
}
