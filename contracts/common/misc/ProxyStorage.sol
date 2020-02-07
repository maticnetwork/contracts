pragma solidity ^0.5.2;
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract ProxyStorage is Ownable {
    address internal proxyTo;
}
