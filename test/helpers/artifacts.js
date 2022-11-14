export const RootChain = artifacts.require('RootChain')
export const RootChainProxy = artifacts.require('RootChainProxy')
export const Registry = artifacts.require('Registry')
export const Governance = artifacts.require('Governance')
export const GovernanceLockableTest = artifacts.require('GovernanceLockableTest')
export const GovernanceProxy = artifacts.require('GovernanceProxy')
export const StakeManager = artifacts.require('StakeManager')
export const StakeManagerExtension = artifacts.require('StakeManagerExtension')
export const StakeManagerTest = artifacts.require('StakeManagerTest')
export const StakeManagerProxy = artifacts.require('StakeManagerProxy')
export const DrainStakeManager = artifacts.require('DrainStakeManager')

export const StakingInfo = artifacts.require('StakingInfo')
export const EventsHubProxy = artifacts.require('EventsHubProxy')
export const EventsHub = artifacts.require('EventsHub')
export const StakingNFT = artifacts.require('StakingNFT')
export const ValidatorShareProxy = artifacts.require('ValidatorShareProxy')
export const ValidatorShare = artifacts.require('ValidatorShareTest')
export const IValidatorShare = artifacts.require('IValidatorShare')

export const StakeManagerTestable = artifacts.require('StakeManagerTestable')
export const ValidatorShareFactory = artifacts.require('ValidatorShareFactory')
export const SlashingManager = artifacts.require('SlashingManager')

export const DepositManager = artifacts.require('DepositManager')
export const DepositManagerProxy = artifacts.require('DepositManagerProxy')
export const Drainable = artifacts.require('Drainable')
export const WithdrawManager = artifacts.require('WithdrawManager')
export const WithdrawManagerProxy = artifacts.require('WithdrawManagerProxy')
export const StateSender = artifacts.require('StateSender')

export const ERC20Predicate = artifacts.require('ERC20Predicate')
export const ERC20PredicateBurnOnly = artifacts.require('ERC20PredicateBurnOnly')
export const ERC721Predicate = artifacts.require('ERC721Predicate')
export const ERC721PredicateBurnOnly = artifacts.require('ERC721PredicateBurnOnly')
export const MintableERC721Predicate = artifacts.require('MintableERC721Predicate')
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
export const RootERC721 = artifacts.require('RootERC721')
export const ERC721PlasmaMintable = artifacts.require('ERC721PlasmaMintable')
export const ExitNFT = artifacts.require('ExitNFT')

// Misc
export const GnosisSafeProxy = artifacts.require('GnosisSafeProxy')
export const GnosisSafe = artifacts.require('GnosisSafe')

// child chain
export const childContracts = {
  Marketplace: artifacts.require('Marketplace'),
  ChildChain: artifacts.require('ChildChain'),
  ChildTokenProxy: artifacts.require('ChildTokenProxy'),
  ChildERC20: artifacts.require('ChildERC20'),
  ChildERC20Proxified: artifacts.require('ChildERC20Proxified'),
  ChildERC721: artifacts.require('ChildERC721'),
  ChildERC721Proxified: artifacts.require('ChildERC721Proxified'),
  ChildERC721Mintable: artifacts.require('ChildERC721Mintable'),
  MRC20: artifacts.require('MRC20'),
  TestMRC20: artifacts.require('TestMRC20')
}
