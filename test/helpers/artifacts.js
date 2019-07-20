export const RootChain = artifacts.require('RootChain')
export const Registry = artifacts.require('Registry')
export const StakeManager = artifacts.require('StakeManager')
export const ValidatorContract = artifacts.require('ValidatorContract')
export const DelegationManager = artifacts.require('DelegationManager')

export const DepositManager = artifacts.require('DepositManager')
export const DepositManagerProxy = artifacts.require('DepositManagerProxy')
export const WithdrawManager = artifacts.require('WithdrawManager')
export const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')

export const ERC20Predicate = artifacts.require('ERC20Predicate')
export const ERC721Predicate = artifacts.require('ERC721Predicate')
export const MarketplacePredicate = artifacts.require('MarketplacePredicate')
export const MarketplacePredicateTest = artifacts.require(
  'MarketplacePredicateTest'
)

// tokens
export const MaticWETH = artifacts.require('MaticWETH')
export const TestToken = artifacts.require('TestToken')
export const RootERC721 = artifacts.require('RootERC721')
export const ERC721PlasmaMintable = artifacts.require('ERC721PlasmaMintable')
export const ExitNFT = artifacts.require('ExitNFT.sol')

// child chain
export const Marketplace = artifacts.require('Marketplace')
export const ChildChain = artifacts.require('ChildChain')
export const ChildERC20 = artifacts.require('ChildERC20')
export const ChildERC721 = artifacts.require('ChildERC721')
export const ChildERC721Mintable = artifacts.require('ChildERC721Mintable')
