export const RootChain = artifacts.require("RootChain");
export const Registry = artifacts.require("Registry");
export const StakeManager = artifacts.require("MockStakeManager");
export const DepositManager = artifacts.require("DepositManager");
export const DepositManagerProxy = artifacts.require("DepositManagerProxy");
export const WithdrawManager = artifacts.require("WithdrawManager");
export const WithdrawManagerProxy = artifacts.require("WithdrawManagerProxy");

// tokens
export const MaticWETH = artifacts.require('MaticWETH')
export const TestToken = artifacts.require('TestToken')
export const RootERC721 = artifacts.require('RootERC721')

// child chain
export const ChildChain = artifacts.require('ChildChain')
export const ChildERC20 = artifacts.require('ChildERC20')
