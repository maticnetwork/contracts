export const RootChain = artifacts.require('RootChain')
export const Registry = artifacts.require('Registry')
export const StakeManager = artifacts.require('StakeManager')
export const SlashingManager = artifacts.require('SlashingManager')
export const ValidatorContract = artifacts.require('ValidatorContract')
export const DelegationManager = artifacts.require('DelegationManager')
export const StakeManagerTest = artifacts.require('StakeManagerTest')

export const DepositManager = artifacts.require('DepositManager')
export const DepositManagerProxy = artifacts.require('DepositManagerProxy')
export const WithdrawManager = artifacts.require('WithdrawManager')
export const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
export const StateSender = artifacts.require('StateSender')

export const ERC20Predicate = artifacts.require('ERC20Predicate')
export const ERC721Predicate = artifacts.require('ERC721Predicate')
export const MarketplacePredicate = artifacts.require('MarketplacePredicate')
export const MarketplacePredicateTest = artifacts.require(
  'MarketplacePredicateTest'
)
export const TransferWithSigPredicate = artifacts.require(
  'TransferWithSigPredicate'
)

// tokens
export const MaticWETH = artifacts.require('MaticWETH')
export const TestToken = artifacts.require('TestToken')
export const DummyERC20 = artifacts.require('DummyERC20')
export const RootERC721 = artifacts.require('RootERC721')
export const ERC721PlasmaMintable = artifacts.require('ERC721PlasmaMintable')
export const ExitNFT = artifacts.require('ExitNFT')

// child chain
export const childContracts = {
  Marketplace: artifacts.require('Marketplace'),
  ChildChain: artifacts.require('ChildChain'),
  ChildERC20: artifacts.require('ChildERC20'),
  ChildERC721: artifacts.require('ChildERC721'),
  ChildERC721Mintable: artifacts.require('ChildERC721Mintable'),
  MaticChildERC20: artifacts.require('MaticChildERC20'),
  TestMaticChildERC20: artifacts.require('TestMaticChildERC20')
}
